const express = require('express');
const router = express.Router();
const db = require('../db');

// 一覧取得
router.get('/', (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            source: req.query.source,
            search: req.query.search,
            date_from: req.query.date_from,
            date_to: req.query.date_to
        };
        const reservations = db.getAllReservations(filters);
        res.json({ success: true, data: reservations });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
    }
});

// 統計情報
router.get('/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// 最近の予約
router.get('/recent', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
        const recent = db.getRecentReservations(limit);
        res.json({ success: true, data: recent });
    } catch (error) {
        console.error('Error fetching recent reservations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch recent reservations' });
    }
});

// 詳細取得
router.get('/:id', (req, res) => {
    try {
        const reservation = db.getReservationById(req.params.id);
        if (!reservation) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        res.json({ success: true, data: reservation });
    } catch (error) {
        console.error('Error fetching reservation details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reservation' });
    }
});

// 新規作成
router.post('/', (req, res) => {
    try {
        const { guest_name, check_in, check_out } = req.body;
        
        // 簡単なバリデーション
        if (!guest_name || !check_in || !check_out) {
            return res.status(400).json({ success: false, error: 'guest_name, check_in, and check_out are required' });
        }

        const newReservation = db.createReservation(req.body);
        res.status(201).json({ success: true, data: newReservation });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ success: false, error: 'Failed to create reservation' });
    }
});

// 更新
router.put('/:id', (req, res) => {
    try {
        const updatedReservation = db.updateReservation(req.params.id, req.body);
        if (!updatedReservation) {
            return res.status(404).json({ success: false, error: 'Reservation not found or no changes made' });
        }
        res.json({ success: true, data: updatedReservation });
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ success: false, error: 'Failed to update reservation' });
    }
});

// 削除
router.delete('/:id', (req, res) => {
    try {
        const deleted = db.deleteReservation(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Reservation not found' });
        }
        res.json({ success: true, data: null });
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ success: false, error: 'Failed to delete reservation' });
    }
});

module.exports = router;
