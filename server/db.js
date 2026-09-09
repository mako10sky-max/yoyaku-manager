const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'reservations.db'));

// Initialize table
db.exec(`
    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_name TEXT NOT NULL,
        booker_name TEXT,
        check_in TEXT NOT NULL,
        check_out TEXT NOT NULL,
        num_guests INTEGER DEFAULT 1,
        room_type TEXT,
        room_number TEXT,
        price INTEGER,
        contact TEXT,
        allergies TEXT,
        notes TEXT,
        status TEXT DEFAULT 'confirmed',
        source TEXT DEFAULT 'other',
        line_user_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// 既存テーブルへのカラム追加マイグレーション
try {
    db.exec(`ALTER TABLE reservations ADD COLUMN room_number TEXT`);
} catch (e) {}

try {
    db.exec(`ALTER TABLE reservations ADD COLUMN has_allergy INTEGER DEFAULT 0`);
} catch (e) {}

// Seed initial data if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM reservations').get();
if (count.count === 0) {
    const insert = db.prepare(`
        INSERT INTO reservations (guest_name, check_in, check_out, num_guests, status, source, room_number, has_allergy, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // サンプルデータ
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    insert.run('山田 太郎', formatDate(today), formatDate(tomorrow), 2, 'confirmed', 'phone', '101', 1, 'エビ・カニ');
    insert.run('鈴木 花子', formatDate(today), formatDate(tomorrow), 1, 'tentative', 'line', '202', 0, '');
    insert.run('佐藤 次郎', '2026-10-01', '2026-10-03', 4, 'confirmed', 'email', '305', 0, '');
}

// CRUD
function getAllReservations(filters = {}) {
    let query = 'SELECT * FROM reservations WHERE 1=1';
    const params = [];

    if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
    }
    if (filters.source) {
        query += ' AND source = ?';
        params.push(filters.source);
    }
    if (filters.search) {
        query += ' AND (guest_name LIKE ? OR booker_name LIKE ? OR room_number LIKE ? OR allergies LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.date_from) {
        query += ' AND check_in >= ?';
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        query += ' AND check_out <= ?';
        params.push(filters.date_to);
    }

    query += ' ORDER BY check_in ASC';
    
    const rows = db.prepare(query).all(params);
    return rows.map(r => {
        if (!r.room_number && r.notes) {
            const match = r.notes.match(/(?:部屋[:：]?\s*|No\.?\s*)?(\d{3,4})(?:号室|号|に決まりました)?/i);
            if (match) r.room_number = match[1];
        }
        return r;
    });
}

function getReservationById(id) {
    const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (r && !r.room_number && r.notes) {
        const match = r.notes.match(/(?:部屋[:：]?\s*|No\.?\s*)?(\d{3,4})(?:号室|号|に決まりました)?/i);
        if (match) r.room_number = match[1];
    }
    return r;
}

function createReservation(data) {
    const {
        guest_name, booker_name, check_in, check_out, num_guests,
        room_type, room_number, price, contact, has_allergy, allergies, notes, status, source, line_user_id
    } = data;

    const stmt = db.prepare(`
        INSERT INTO reservations (
            guest_name, booker_name, check_in, check_out, num_guests,
            room_type, room_number, price, contact, has_allergy, allergies, notes, status, source, line_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
        guest_name, booker_name, check_in, check_out, num_guests || 1,
        room_type, room_number, price, contact, has_allergy ? 1 : 0, allergies, notes, status || 'confirmed', source || 'other', line_user_id
    );

    return getReservationById(info.lastInsertRowid);
}

function updateReservation(id, data) {
    const fields = [];
    const params = [];
    
    const updatableFields = [
        'guest_name', 'booker_name', 'check_in', 'check_out', 'num_guests',
        'room_type', 'room_number', 'price', 'contact', 'has_allergy', 'allergies', 'notes', 'status', 'source', 'line_user_id'
    ];

    for (const field of updatableFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            params.push(field === 'has_allergy' ? (data[field] ? 1 : 0) : data[field]);
        }
    }

    if (fields.length === 0) return getReservationById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = db.prepare(`UPDATE reservations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(params);

    return getReservationById(id);
}

function deleteReservation(id) {
    const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
}

function getStats() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); // YYYY-MM

    const checkInsToday = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE check_in = ?').get(today).count;
    const checkOutsToday = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE check_out = ?').get(today).count;
    const bookingsThisMonth = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE check_in LIKE ?').get(`${currentMonth}%`).count;
    
    const statuses = db.prepare('SELECT status, COUNT(*) as count FROM reservations GROUP BY status').all();
    const statusCounts = statuses.reduce((acc, curr) => {
        acc[curr.status] = curr.count;
        return acc;
    }, { confirmed: 0, tentative: 0, cancelled: 0 });

    return {
        checkInsToday,
        checkOutsToday,
        bookingsThisMonth,
        statusCounts
    };
}

function getRecentReservations(limit = 5) {
    const rows = db.prepare('SELECT * FROM reservations ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map(r => {
        if (!r.room_number && r.notes) {
            const match = r.notes.match(/(?:部屋[:：]?\s*|No\.?\s*)?(\d{3,4})(?:号室|号|に決まりました)?/i);
            if (match) r.room_number = match[1];
        }
        return r;
    });
}

module.exports = {
    getAllReservations,
    getReservationById,
    createReservation,
    updateReservation,
    deleteReservation,
    getStats,
    getRecentReservations
};
