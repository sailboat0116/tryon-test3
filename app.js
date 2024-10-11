const express = require('express');
const path = require('path');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Router setup
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const axios = require("axios");
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'db', 'sqlite.db'), (err) => {
    if (err) {
        console.error('資料庫連接失敗:', err.message);
    } else {
        console.log('已成功連接到 SQLite3 資料庫。');
    }
});

const ans_db = new sqlite3.Database(path.join(__dirname, 'db', 'ans.db'), (err) => {
    if (err) {
        console.error('資料庫連接失敗:', err.message);
    } else {
        console.log('已成功連接到 ans 資料庫。');
    }
});

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'images', 'people')),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// API routes
app.post('/api/register', (req, res) => {
    const { account, password } = req.body;
    db.get('SELECT account FROM account_password WHERE account = ?', [account], (err, row) => {
        if (err) return res.status(500).send('Internal Server Error');
        if (row) return res.send('已有帳號囉');
        db.run('INSERT INTO account_password (account, password) VALUES (?, ?)', [account, password], (err) => {
            if (err) return res.status(500).send('Internal Server Error');
            res.send('帳號創建成功');
        });
    });
});

app.post('/api/login', (req, res) => {
    const { account, password } = req.body;
    db.get('SELECT * FROM account_password WHERE account = ? AND password = ?', [account, password], (err, row) => {
        if (err) return res.status(500).send({ message: '資料庫錯誤' });
        res.send(row ? { success: true } : { success: false, message: '無效的憑證' });
    });
});

app.post('/api/forget', (req, res) => {
    const { account } = req.body;
    db.get('SELECT password FROM account_password WHERE account = ?', [account], (err, row) => {
        if (err) return res.status(500).send({ message: '資料庫錯誤' });
        res.send(row ? { success: true, password: row.password } : { success: false, message: '沒有這個帳號唷' });
    });
});

app.post('/upload', upload.single('image'), (req, res) => {
    res.json(req.file ? { success: true, filename: req.file.filename } : { success: false, message: '上傳失敗' });
});

app.post('/api/wrong', (req, res) => {
    const { user_id, type, number } = req.body;

    // 在終端機打印 user_id, type, number
    console.log(`User ID: ${user_id}, Type: ${type}, Number: ${number}`);

    // 先檢查是否已經存在相同的記錄
    const checkSql = 'SELECT * FROM answerrecords WHERE user_id = ? AND type = ? AND number = ?';

    ans_db.get(checkSql, [user_id, type, number], (err, row) => {
        if (err) {
            console.error('查詢記錄時發生錯誤:', err);
            return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
        }

        // 如果找到了相同的記錄，則不插入
        if (row) {
            return res.status(200).json({ success: false, message: '記錄已存在，未插入新數據' });
        }

        // 否則插入新記錄
        const insertSql = 'INSERT INTO answerrecords (user_id, type, number) VALUES (?, ?, ?)';
        ans_db.run(insertSql, [user_id, type, number], function(err) {
            if (err) {
                console.error('插入記錄時發生錯誤:', err);
                return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
            }

            // 插入成功
            return res.status(200).json({ success: true, message: '記錄已成功插入' });
        });
    });
});


app.post('/api/correct', (req, res) => {
    const { user_id, type, number } = req.body;

    // 將收到的參數印在終端機
    console.log('Received data for correct answer:', { user_id, type, number });

    // 查詢資料庫中是否存在相同的記錄
    const selectSql = 'SELECT * FROM answerrecords WHERE user_id = ? AND type = ? AND number = ?';
    ans_db.get(selectSql, [user_id, type, number], (err, row) => {
        if (err) {
            console.error('查詢記錄時發生錯誤:', err);
            return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
        }

        // 如果找到記錄，則刪除該筆記錄
        if (row) {
            const deleteSql = 'DELETE FROM answerrecords WHERE user_id = ? AND type = ? AND number = ?';
            ans_db.run(deleteSql, [user_id, type, number], function(err) {
                if (err) {
                    console.error('刪除記錄時發生錯誤:', err);
                    return res.status(500).json({ success: false, message: '刪除記錄時發生錯誤' });
                }

                console.log('記錄已成功刪除:', { user_id, type, number });
                res.json({ success: true, message: '記錄已成功刪除' });
            });
        } else {
            // 如果沒有找到記錄，返回提示
            res.json({ success: false, message: '未找到符合條件的記錄' });
        }
    });
});

app.post('/api/result', (req, res) => {
    const { user_id } = req.body;

    // 查詢資料庫中指定user_id且type為1, 2, 3, 4的記錄數量
    const selectSql = `
        SELECT type, COUNT(*) as count 
        FROM answerrecords 
        WHERE user_id = ? 
        AND type IN (1, 2, 3, 4) 
        GROUP BY type
    `;

    ans_db.all(selectSql, [user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database query failed' });
        }

        // 初始化一個物件來儲存每個type的計數
        const result = {
            type1: 0,
            type2: 0,
            type3: 0,
            type4: 0
        };

        // 依照type的值來更新對應的計數
        rows.forEach(row => {
            switch (row.type) {
                case 1:
                    result.type1 = row.count;
                    break;
                case 2:
                    result.type2 = row.count;
                    break;
                case 3:
                    result.type3 = row.count;
                    break;
                case 4:
                    result.type4 = row.count;
                    break;
                default:
                    break;
            }
        });
        // 回傳結果給客戶端
        res.json(result);
    });
});


const uploads = multer();
const ASSISTANT_API = "https://prod.dvcbot.net/api/assts/v1";
const ASSISTANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJEVkNBU1NJIiwic3ViIjoiTUlOR0NMSVVARkNVLkVEVS5UVyIsImF1ZCI6WyJEVkNBU1NJIl0sImlhdCI6MTcyODYyMzI0OSwianRpIjoiMjhmZWI1NDAtODVkNy00ZmIwLTlhZjctODA3YTgyNzQyMjBiIn0.svaX1g8-nluLto2UgSjFwhyoI_je0WemWpxDdTvsCCo";
const ASSISTANT_ID = "asst_dvc_ODLt4b785D3YoXyeyjR6mm17";
const fs = require('fs');

// 定義預設圖片路徑
const defaultImagePath = path.join(__dirname, 'uploads', 'aaa.jpg')

app.post('/run-assistant', uploads.single('image'), async (req, res) => {
    try {
        const userPrompt = req.body.prompt;
        const imageFile = req.file;

        // Create a thread
        const threadResponse = await axios.post(`${ASSISTANT_API}/threads`, {}, {
            headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
        });
        const threadId = threadResponse.data.id;

        // Prepare message content with user prompt
        let content = [{ type: "text", text: userPrompt }];

        // Conditionally add image to content if uploaded
        if (imageFile) {
            const base64Image = imageFile.buffer.toString('base64');
            content.push({
                type: "image_url",
                image_url: {
                    url: `data:${imageFile.mimetype};base64,${base64Image}`
                }
            });
        }

        // Add the message to the thread
        await axios.post(`${ASSISTANT_API}/threads/${threadId}/messages`, {
            role: "user",
            content: content
        }, {
            headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
        });

        // Run the assistant
        const runResponse = await axios.post(`${ASSISTANT_API}/threads/${threadId}/runs`, {
            assistant_id: ASSISTANT_ID
        }, {
            headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
        });
        const runId = runResponse.data.id;

        // Poll for completion
        let runStatus = 'in_progress';
        while (runStatus === 'in_progress' || runStatus === 'queued') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const statusResponse = await axios.get(`${ASSISTANT_API}/threads/${threadId}/runs/${runId}`, {
                headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
            });
            runStatus = statusResponse.data.status;
        }

        // Fetch messages
        const messagesResponse = await axios.get(`${ASSISTANT_API}/threads/${threadId}/messages`, {
            headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
        });

        // Extract assistant's response
        const assistantResponse = messagesResponse.data.data
            .filter(msg => msg.role === 'assistant')
            .flatMap(msg => msg.content)
            .map(content => content.text?.value || '')
            .join('\n');

        // Clean up: delete the thread
        await axios.delete(`${ASSISTANT_API}/threads/${threadId}`, {
            headers: { 'Authorization': `Bearer ${ASSISTANT_API_KEY}` }
        });

        res.json({ response: assistantResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

module.exports = app;