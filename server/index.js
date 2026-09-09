require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const line = require('@line/bot-sdk');

const reservationsRouter = require('./routes/reservations');
const lineWebhookRouter = require('./routes/line-webhook');
const calendarRouter = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// publicディレクトリの静的ファイル配信
app.use(express.static(path.join(__dirname, '..', 'public')));

// LINE Webhookは raw body が必要なため、express.json() の前に配置
app.use('/api/line', lineWebhookRouter);

// JSONパーサー
app.use(express.json());

// APIルート
app.use('/api/reservations', reservationsRouter);
app.use('/api/calendar', calendarRouter);

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something broke!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
