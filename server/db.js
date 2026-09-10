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

try {
    db.exec(`ALTER TABLE reservations ADD COLUMN booker_name TEXT`);
} catch (e) {}

try {
    db.exec(`ALTER TABLE reservations ADD COLUMN price_tier TEXT DEFAULT 'unconfirmed'`);
} catch (e) {}

try {
    db.exec(`ALTER TABLE reservations ADD COLUMN allergy_status TEXT DEFAULT 'unconfirmed'`);
} catch (e) {}

// 既存データのカラム補正
try {
    db.exec(`UPDATE reservations SET price_tier = 'unconfirmed' WHERE price_tier IS NULL`);
    db.exec(`UPDATE reservations SET allergy_status = CASE WHEN has_allergy = 1 THEN 'has' WHEN allergies IS NOT NULL AND allergies != '' THEN 'has' ELSE 'unconfirmed' END WHERE allergy_status IS NULL OR allergy_status = ''`);
    db.exec(`UPDATE reservations SET booker_name = guest_name WHERE (booker_name IS NULL OR booker_name = '') AND source = 'line'`);
} catch (e) {}

// Seed initial data if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM reservations').get();
if (count.count === 0) {
    const insert = db.prepare(`
        INSERT INTO reservations (guest_name, booker_name, check_in, check_out, num_guests, status, source, room_number, price_tier, allergy_status, has_allergy, allergies)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // サンプルデータ
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    insert.run('山田 太郎', '山田 太郎', formatDate(today), formatDate(tomorrow), 2, 'confirmed', 'phone', '101', 'general', 'has', 1, 'エビ・カニ');
    insert.run('鈴木 花子', '鈴木 一郎', formatDate(today), formatDate(tomorrow), 1, 'tentative', 'line', '202', 's_guest', 'none', 0, '');
    insert.run('佐藤 次郎', '', '2026-10-01', '2026-10-03', 4, 'confirmed', 'email', '', 'unconfirmed', 'unconfirmed', 0, '');
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
    if (filters.price_tier) {
        query += ' AND price_tier = ?';
        params.push(filters.price_tier);
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
        if (!r.price_tier) r.price_tier = 'unconfirmed';
        if (!r.allergy_status) {
            r.allergy_status = r.has_allergy === 1 ? 'has' : (r.allergies ? 'has' : 'unconfirmed');
        }
        return r;
    });
}

function getReservationById(id) {
    const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (r) {
        if (!r.room_number && r.notes) {
            const match = r.notes.match(/(?:部屋[:：]?\s*|No\.?\s*)?(\d{3,4})(?:号室|号|に決まりました)?/i);
            if (match) r.room_number = match[1];
        }
        if (!r.price_tier) r.price_tier = 'unconfirmed';
        if (!r.allergy_status) {
            r.allergy_status = r.has_allergy === 1 ? 'has' : (r.allergies ? 'has' : 'unconfirmed');
        }
    }
    return r;
}

function createReservation(data) {
    const {
        guest_name, booker_name, check_in, check_out, num_guests,
        room_type, room_number, price, contact, price_tier, allergy_status, has_allergy, allergies, notes, status, source, line_user_id
    } = data;

    const finalAllergyStatus = allergy_status || (has_allergy === 1 ? 'has' : (has_allergy === 0 ? 'none' : 'unconfirmed'));
    const finalHasAllergy = (finalAllergyStatus === 'has' || has_allergy) ? 1 : 0;
    const finalPriceTier = price_tier || 'unconfirmed';

    const stmt = db.prepare(`
        INSERT INTO reservations (
            guest_name, booker_name, check_in, check_out, num_guests,
            room_type, room_number, price, contact, price_tier, allergy_status, has_allergy, allergies, notes, status, source, line_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
        guest_name, booker_name || '', check_in, check_out, num_guests || 1,
        room_type || 'standard', room_number || '', price || 0, contact || '',
        finalPriceTier, finalAllergyStatus, finalHasAllergy, allergies || '', notes || '',
        status || 'confirmed', source || 'other', line_user_id || null
    );

    return getReservationById(info.lastInsertRowid);
}

function updateReservation(id, data) {
    const fields = [];
    const params = [];
    
    const updatableFields = [
        'guest_name', 'booker_name', 'check_in', 'check_out', 'num_guests',
        'room_type', 'room_number', 'price', 'contact', 'price_tier', 'allergy_status',
        'has_allergy', 'allergies', 'notes', 'status', 'source', 'line_user_id'
    ];

    for (const field of updatableFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            let val = data[field];
            if (field === 'has_allergy') {
                val = val ? 1 : 0;
            }
            params.push(val);
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

    // 未確認項目のカウント (要確認件数) ※フロントのgetUnconfirmedItems()と同じ条件①〜⑤
    const unconfirmedCount = db.prepare(`
        SELECT COUNT(*) as count FROM reservations 
        WHERE status != 'cancelled' AND (
            guest_name IS NULL OR guest_name = '' OR
            booker_name IS NULL OR booker_name = '' OR
            check_in IS NULL OR check_in = '' OR
            check_out IS NULL OR check_out = '' OR
            room_number IS NULL OR room_number = '' OR room_number = '未定' OR
            num_guests IS NULL OR num_guests <= 0 OR
            price_tier IS NULL OR price_tier = 'unconfirmed' OR price_tier = '' OR
            allergy_status IS NULL OR allergy_status = 'unconfirmed' OR allergy_status = ''
        )
    `).get().count;

    return {
        checkInsToday,
        checkOutsToday,
        bookingsThisMonth,
        statusCounts,
        unconfirmedCount
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

function syncReservations(items) {
    if (!Array.isArray(items) || items.length === 0) return getAllReservations();

    const insertStmt = db.prepare(`
        INSERT INTO reservations (
            id, guest_name, booker_name, check_in, check_out, num_guests,
            room_type, room_number, price, contact, price_tier, allergy_status, has_allergy, allergies, notes, status, source, line_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
        UPDATE reservations SET
            guest_name = ?, booker_name = ?, check_in = ?, check_out = ?, num_guests = ?,
            room_type = ?, room_number = ?, price = ?, contact = ?, price_tier = ?, allergy_status = ?,
            has_allergy = ?, allergies = ?, notes = ?, status = ?, source = ?, line_user_id = ?, updated_at = ?
        WHERE id = ?
    `);

    const checkStmt = db.prepare('SELECT id FROM reservations WHERE id = ?');
    const findSameStmt = db.prepare('SELECT id FROM reservations WHERE guest_name = ? AND check_in = ? AND check_out = ?');

    const transaction = db.transaction((list) => {
        for (const item of list) {
            if (!item.guest_name || !item.check_in || !item.check_out) continue;

            const existingById = item.id ? checkStmt.get(item.id) : null;
            const existingByMatch = !existingById ? findSameStmt.get(item.guest_name, item.check_in, item.check_out) : null;
            const targetId = existingById ? item.id : (existingByMatch ? existingByMatch.id : null);

            const allergyStatus = item.allergy_status || (item.has_allergy === 1 ? 'has' : (item.allergies ? 'has' : 'unconfirmed'));
            const hasAllergy = (allergyStatus === 'has' || item.has_allergy) ? 1 : 0;
            const priceTier = item.price_tier || 'unconfirmed';
            const updatedAt = item.updated_at || new Date().toISOString();

            if (targetId) {
                // 既存レコードの更新
                updateStmt.run(
                    item.guest_name, item.booker_name || '', item.check_in, item.check_out, item.num_guests || 1,
                    item.room_type || 'standard', item.room_number || '', item.price || 0, item.contact || '',
                    priceTier, allergyStatus, hasAllergy, item.allergies || '', item.notes || '',
                    item.status || 'confirmed', item.source || 'other', item.line_user_id || null, updatedAt,
                    targetId
                );
            } else {
                // 新規挿入（IDが指定されていればそのIDを使用、なければ自動採番）
                const createdAt = item.created_at || new Date().toISOString();
                if (item.id) {
                    try {
                        insertStmt.run(
                            item.id, item.guest_name, item.booker_name || '', item.check_in, item.check_out, item.num_guests || 1,
                            item.room_type || 'standard', item.room_number || '', item.price || 0, item.contact || '',
                            priceTier, allergyStatus, hasAllergy, item.allergies || '', item.notes || '',
                            item.status || 'confirmed', item.source || 'other', item.line_user_id || null, createdAt, updatedAt
                        );
                    } catch (e) {
                        // ID競合時はIDなしで追加
                        createReservation(item);
                    }
                } else {
                    createReservation(item);
                }
            }
        }
    });

    transaction(items);
    return getAllReservations();
}

module.exports = {
    getAllReservations,
    getReservationById,
    createReservation,
    updateReservation,
    deleteReservation,
    getStats,
    getRecentReservations,
    syncReservations
};
