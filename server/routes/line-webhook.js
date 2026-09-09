const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const db = require('../db');
const { generateGoogleCalendarUrl } = require('../google-calendar');

// 環境変数が設定されていない場合でもクラッシュしないように
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy',
    channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy'
};

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken
});

// LINE Webhook エンドポイント
router.post('/webhook', line.middleware(config), async (req, res) => {
    // 環境変数が設定されていない（ダミーの）場合は処理をスキップ
    if (config.channelSecret === 'dummy') {
        console.warn('LINE_CHANNEL_SECRET is not set. Skipping webhook processing.');
        return res.status(200).end();
    }

    try {
        const results = await Promise.all(req.body.events.map(handleEvent));
        res.json(results);
    } catch (err) {
        console.error('Error processing LINE webhook:', err);
        res.status(500).end();
    }
});

async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const text = event.message.text;
    const userId = event.source.userId;

    // 「予約」または「宿泊」というキーワードが含まれているかチェック
    if (text.includes('予約') || text.includes('宿泊')) {
        // 簡易的な情報抽出
        let checkIn = extractDate(text) || new Date().toISOString().split('T')[0];
        // 簡易的に1泊とする
        let nextDay = new Date(checkIn);
        nextDay.setDate(nextDay.getDate() + 1);
        let checkOut = nextDay.toISOString().split('T')[0];
        
        let numGuests = extractNumGuests(text) || 1;
        let roomNumber = extractRoomNumber(text);
        let allergyInfo = extractAllergies(text);
        
        // ユーザープロフィールから名前を取得して仮のゲスト名にする
        let guestName = 'LINE User';
        try {
            const profile = await client.getProfile(userId);
            guestName = profile.displayName;
        } catch (e) {
            console.error('Failed to get user profile', e);
        }

        // DBに仮予約として登録
        const reservationData = {
            guest_name: guestName,
            check_in: checkIn,
            check_out: checkOut,
            num_guests: numGuests,
            room_number: roomNumber,
            has_allergy: allergyInfo.hasAllergy ? 1 : 0,
            allergies: allergyInfo.details,
            status: 'tentative',
            source: 'line',
            line_user_id: userId,
            notes: `LINEからの仮予約リクエスト:\n${text}`
        };

        const created = db.createReservation(reservationData);

        // 確認メッセージを返信
        let replyText = `ご予約リクエストを承りました。\n\nお名前: ${guestName}様\nチェックイン: ${checkIn}\n人数: ${numGuests}名`;
        if (roomNumber) {
            replyText += `\nお部屋: ${roomNumber}号室`;
        }
        if (allergyInfo.hasAllergy) {
            replyText += `\nアレルギー: あり (${allergyInfo.details})`;
        }
        
        const calUrl = generateGoogleCalendarUrl(created);
        replyText += `\n\n📅 Googleカレンダーに登録:\n${calUrl}`;
        replyText += `\n\n担当者が確認の上、折り返しご連絡いたします。`;
        
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: replyText }]
        });
    }

    // 予約関連でないメッセージには固定で返信するか、何も返さない
    return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ご予約をご希望の場合は、「予約」という言葉と一緒に希望日や人数をお知らせください。' }]
    });
}

// 簡易的な日付抽出（例: 10/1, 10月1日, 2026-10-01）
function extractDate(text) {
    const match = text.match(/(\d{4}[-/年])?(\d{1,2})[-/月](\d{1,2})日?/);
    if (match) {
        const year = match[1] ? match[1].replace(/[-/年]/g, '') : new Date().getFullYear();
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return null;
}

// 簡易的な人数抽出（例: 2名, 2人）
function extractNumGuests(text) {
    const match = text.match(/(\d+)[名人]/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// 部屋番号抽出（例: 202, 202号室, 部屋202, 202に決まりました）
function extractRoomNumber(text) {
    const match = text.match(/(?:部屋[:：]?\s*|No\.?\s*)?(\d{3,4})(?:号室|号|に決まりました)?/i);
    if (match) {
        return match[1];
    }
    return null;
}

// アレルギー情報抽出
function extractAllergies(text) {
    const keywords = ['アレルギー', 'エビ', 'カニ', '甲殻類', 'そば', '蕎麦', '卵', 'タマゴ', '乳', '牛乳', '小麦', 'ピーナッツ', 'ナッツ', 'NG', 'ダメ'];
    const hasAllergy = keywords.some(k => text.includes(k));
    
    if (!hasAllergy) {
        return { hasAllergy: false, details: '' };
    }
    
    // 詳細箇所の抽出試行
    const match = text.match(/(?:アレルギー[：:\s]*|NG[：:\s]*)([^\n,。]+)/);
    const details = match ? match[1].trim() : 'あり（詳細は本文参照）';
    return { hasAllergy: true, details };
}

module.exports = router;
