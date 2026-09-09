const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateGoogleCalendarUrl, generateIcsFeed } = require('../google-calendar');

// Google カレンダー自動同期用 iCal フィード (全予約)
router.get('/feed.ics', (req, res) => {
    try {
        const reservations = db.getAllReservations();
        const icsContent = generateIcsFeed(reservations);
        
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="reservations.ics"');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(icsContent);
    } catch (error) {
        console.error('Error generating calendar feed:', error);
        res.status(500).send('Error generating calendar feed');
    }
});

// 個別予約の Google カレンダー登録URL取得
router.get('/url/:id', (req, res) => {
    try {
        const reservation = db.getReservationById(req.params.id);
        if (!reservation) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        const calendarUrl = generateGoogleCalendarUrl(reservation);
        res.json({ success: true, url: calendarUrl });
    } catch (error) {
        console.error('Error generating calendar URL:', error);
        res.status(500).json({ success: false, error: 'Failed to generate calendar URL' });
    }
});

module.exports = router;
