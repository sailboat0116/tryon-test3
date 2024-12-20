const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 設置 multer 用於文件上傳到磁盤
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});
const uploadDisk = multer({ storage: diskStorage });

// 設置 multer 用於文件上傳到內存
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// 提供靜態文件
app.use(express.static('public'));

// API 設置
const API_URL = 'https://heybeauty.ai/api';
const API_KEY = 'hb-PMAGG0sE0jyut4T9b31c9KoEA1yPgNfW';
const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`
};

// 輔助函數：創建任務
async function createTask(user_img_name, cloth_img_name,category) {
    const response = await axios.post(`${API_URL}/create-task`, {
        user_img_name,
        cloth_img_name,
        category,
        caption: "test"
    }, { headers });

    if (response.data.code !== 0) {
        throw new Error('獲取上傳鏈接失敗');
    }

    return response.data.data;
}

// 輔助函數：提交任務
async function submitTask(task_uuid) {
    const response = await axios.post(`${API_URL}/submit-task`, { task_uuid }, { headers });

    if (response.data.code !== 0) {
        throw new Error('提交任務失敗');
    }
}

// 輔助函數：輪詢任務狀態
async function pollTaskStatus(task_uuid) {
    for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 10000));  // 睡眠 20 秒
        const response = await axios.post(`${API_URL}/get-task-info`, { task_uuid }, { headers });
        console.log('輪詢任務狀態:', response.data);

        if (response.data.code === 0) {
            const { status, tryon_img_url } = response.data.data;
            if (status === 'successed' && tryon_img_url) {
                return tryon_img_url;
            } else if (status === 'failed') {
                throw new Error('任務失敗');
            }
        }
    }
    throw new Error('任務超時');
}

// /upload 路由
app.post('/upload', uploadDisk.single('image'), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({ success: false, message: '沒有上傳文件' });
    }
    const { category } = req.body;
    try {
        const imagePath = path.join(__dirname, req.file.path);
        const tryonPeoplePath = path.join(__dirname, 'uploads', 'tryon-people.jpg');

        // 將上傳的圖片保存為 tryon-people.jpg
        fs.copyFileSync(imagePath, tryonPeoplePath);

        const { uuid, user_img_url, cloth_img_url } = await createTask(req.file.originalname, 'john1.jpg',category);

        // 上傳圖片
        await axios.put(user_img_url, fs.createReadStream(tryonPeoplePath), {
            headers: { 'Content-Type': 'image/jpeg' }
        });
        await axios.put(cloth_img_url, fs.createReadStream(path.join(__dirname, 'uploads', 'john1.jpg')), {
            headers: { 'Content-Type': 'image/jpeg' }
        });

        await submitTask(uuid);

        const tryon_img_url = await pollTaskStatus(uuid);

        // 保存 try-on 圖片到文件
        const tryonImagePath = path.join(__dirname, 'public', 'tryon-image.jpg');
        const tryonImageResponse = await axios.get(tryon_img_url, { responseType: 'arraybuffer' });
        fs.writeFileSync(tryonImagePath, tryonImageResponse.data);

        res.json({
            success: true,
            message: '圖片上傳並處理成功',
            tryonImgUrl: tryon_img_url,
            tryonImgDownloadUrl: '/tryon-image.jpg'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '上傳和處理圖片失敗' });
    }
});

// /tryon 路由
app.post('/tryon', uploadMemory.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: '沒有上傳文件' });
    }
    const { category } = req.body;
    try {
        const fileplace = req.body.fileplace; // 接收 fileplace
        const save_filename = req.body.save_filename; // 接收 save_filename
        const { uuid, user_img_url, cloth_img_url } = await createTask('tryon-people.jpg', req.file.originalname,category);

        // 上傳圖片
        await axios.put(cloth_img_url, req.file.buffer, {
            headers: { 'Content-Type': 'image/jpeg' }
        });
        await axios.put(user_img_url, fs.createReadStream(path.join(__dirname, 'uploads', 'tryon-people.jpg')), {
            headers: { 'Content-Type': 'image/jpeg' }
        });

        await submitTask(uuid);

        const tryon_img_url = await pollTaskStatus(uuid);

        // 保存 try-on 圖片到文件
        const tryonImagePath = path.join(__dirname, fileplace, save_filename);
        const tryonImageResponse = await axios.get(tryon_img_url, { responseType: 'arraybuffer' });
        fs.writeFileSync(tryonImagePath, tryonImageResponse.data);

        res.json({
            success: true,
            message: '圖片處理成功',
            tryonImgUrl: tryon_img_url,
            tryonImgDownloadUrl: save_filename
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '處理 tryon 請求失敗' });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
});