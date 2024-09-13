const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Serve static files (like HTML, CSS, JS)
app.use(express.static('public'));

// Handle file upload
app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
        const imagePath = path.join(__dirname, req.file.path);
        const apiUrl = 'https://heybeauty.ai/api/create-task';
        const apiKey = 'hb-PMAGG0sE0jyut4T9b31c9KoEA1yPgNfW';

        const params = {
            user_img_name: req.file.originalname,
            cloth_img_name: 'john1.jpg',
            category: "4",
            caption: "test"
        };

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        const response = await axios.post(apiUrl, params, { headers });
        if (response.data.code !== 0) {
            throw new Error('Failed to get upload link');
        }

        const { uuid, user_img_url, cloth_img_url } = response.data.data;

        // Upload images
        await axios.put(user_img_url, fs.createReadStream(imagePath), {
            headers: { 'Content-Type': 'image/jpeg' }
        });
        await axios.put(cloth_img_url, fs.createReadStream(path.join(__dirname, 'uploads', 'john1.jpg')), {
            headers: { 'Content-Type': 'image/jpeg' }
        });

        // Submit the task
        const submitTaskUrl = 'https://heybeauty.ai/api/submit-task';
        const submitResponse = await axios.post(submitTaskUrl, { task_uuid: uuid }, { headers });

        if (submitResponse.data.code !== 0) {
            throw new Error('Failed to submit task');
        }

        // Poll task status
        const statusUrl = 'https://heybeauty.ai/api/get-task-info';
        let taskStatusResponse;

        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 20000));  // Sleep for 18 seconds
            taskStatusResponse = await axios.post(statusUrl, { task_uuid: uuid }, { headers });
            console.log('Polling task status:', taskStatusResponse.data);

            if (taskStatusResponse.data.code === 0) {
                const { status, tryon_img_url } = taskStatusResponse.data.data;
                if (status === 'successed' && tryon_img_url) {
                    // Save the try-on image to a file
                    const tryonImagePath = path.join(__dirname, 'public', 'tryon-image.jpg');
                    const tryonImageBuffer = await axios.get(tryon_img_url, { responseType: 'arraybuffer' });
                    fs.writeFileSync(tryonImagePath, tryonImageBuffer.data);

                    // Return the try-on image URL and a download link
                    res.json({
                        success: true,
                        message: 'Image uploaded and task completed successfully',
                        tryonImgUrl: tryon_img_url,
                        tryonImgDownloadUrl: `/tryon-image.jpg`
                    });
                    return;
                } else if (status === 'failed') {
                    res.status(500).json({ success: false, message: 'Task failed or encountered an error' });
                    return;
                }
            } else {
                res.status(500).json({ success: false, message: 'Failed to get task status' });
                return;
            }
        }

        // If after 30 checks, the task is still not completed
        res.status(500).json({ success: false, message: 'Task failed or timeout' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to upload and process image' });
    }
});

// Serve the try-on image
app.get('/tryon-image.jpg', (req, res) => {
    const tryonImagePath = path.join(__dirname, 'public', 'tryon-image.jpg');
    res.sendFile(tryonImagePath);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});