var express = require('express');
var path = require('path');
const multer = require('multer');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sqlite3 = require('sqlite3').verbose();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

var db = new sqlite3.Database(path.join(__dirname, 'db', 'sqlite.db'), (err) => {
    if (err) {
        console.error('資料庫連接失敗:', err.message);
    } else {
        console.log('已成功連接到 SQLite3 資料庫。');
    }
});

app.post('/api/register', (req, res) => {
    let { account, password } = req.body; // 從請求body中提取帳號和密碼

    // 先檢查是否已有相同的帳號
    let checkSql = 'SELECT account FROM account_password WHERE account = ?';
    db.get(checkSql, [account], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (row) {
            // 如果帳號已存在
            res.send('已有帳號囉');
        } else {
            // 如果帳號不存在，插入新帳號
            let insertSql = 'INSERT INTO account_password (account, password) VALUES (?, ?)';
            db.run(insertSql, [account, password], (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                res.send('帳號創建成功');
            });
        }
    });
});




// 登錄路由
app.post('/api/login', (req, res) => {
    let { account, password } = req.body;
    let sql = 'SELECT * FROM account_password WHERE account = ? AND password = ?';
    db.get(sql, [account, password], (err, row) => {
        if (err) {
            return res.status(500).send({ message: '資料庫錯誤' });
        }
        if (row) {
            res.send({ success: true });
        } else {
            res.send({ success: false, message: '無效的憑證' });
        }
    });
});

app.post('/api/forget', (req, res) => {
    let { account } = req.body;
    let sql = 'SELECT password FROM account_password WHERE account = ?';
    db.get(sql, [account], (err, row) => {
        if (err) {
            return res.status(500).send({ message: '資料庫錯誤' });
        }
        if (row) {
            res.send({ success: true, password: row.password });
        } else {
            res.send({ success: false, message: '沒有這個帳號唷' });
        }
    });
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images', 'people'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.json({ success: true, filename: req.file.filename });
    } else {
        res.status(400).json({ success: false, message: '上傳失敗' });
    }
});
module.exports = app;
