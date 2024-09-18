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

module.exports = app;