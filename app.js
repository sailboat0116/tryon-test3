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
//幫我把這三個印在終端機，顯示在我所紀錄的內容

    // 使用參數化查詢來防止 SQL 注入
    const sql = 'INSERT INTO answerrecords (user_id, type, number) VALUES (?, ?, ?)';

    ans_db.run(sql, [user_id, type, number], function(err) {
        if (err) {
            console.error('插入記錄時發生錯誤:', err);
            return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
        }

    });
});

module.exports = app;