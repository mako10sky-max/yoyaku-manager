/**
 * Google Calendar 連携モジュール
 */

// Googleカレンダー登録用ワンクリックURLの生成
function generateGoogleCalendarUrl(reservation) {
    const { guest_name, check_in, check_out, num_guests, room_number, allergies, notes, contact } = reservation;
    
    // 宿泊タイトル
    const roomText = room_number ? `${room_number}号室` : '部屋未定';
    const title = encodeURIComponent(`【宿泊】${guest_name}様 (${roomText})`);
    
    // 日付フォーマット (YYYYMMDD)
    const startDate = check_in.replace(/-/g, '');
    const endDate = check_out.replace(/-/g, '');
    const dates = `${startDate}/${endDate}`;
    
    // 詳細説明
    let details = `■ 宿泊予約詳細\n`;
    details += `・ゲスト名: ${guest_name}様\n`;
    details += `・お部屋: ${roomText}\n`;
    details += `・宿泊人数: ${num_guests || 1}名\n`;
    if (allergies) {
        details += `・アレルギー: あり (${allergies})\n`;
    }
    if (contact) {
        details += `・連絡先: ${contact}\n`;
    }
    if (notes) {
        details += `・メモ: ${notes}\n`;
    }
    
    const encodedDetails = encodeURIComponent(details);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${encodedDetails}`;
}

// iCalendar (ICS) 形式の生成（Googleカレンダー「URLから追加」用）
function generateIcsFeed(reservations) {
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mrs. Ishii//Reservation Management System//JA',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Mrs. Ishii 宿泊予約',
        'X-WR-TIMEZONE:Asia/Tokyo'
    ];

    const formatDate = (dateStr) => dateStr.replace(/-/g, '');

    reservations.forEach(r => {
        if (r.status === 'cancelled') return;

        const roomText = r.room_number ? `${r.room_number}号室` : '部屋未定';
        const summary = `【宿泊】${r.guest_name}様 (${roomText})`;
        const start = formatDate(r.check_in);
        const end = formatDate(r.check_out);
        
        let desc = `ゲスト: ${r.guest_name}様\\n部屋: ${roomText}\\n人数: ${r.num_guests || 1}名`;
        if (r.allergies) desc += `\\nアレルギー: ⚠️あり (${r.allergies})`;
        if (r.contact) desc += `\\n連絡先: ${r.contact}`;
        if (r.notes) desc += `\\nメモ: ${r.notes.replace(/\n/g, '\\n')}`;

        ics.push('BEGIN:VEVENT');
        ics.push(`UID:reservation-${r.id}@mrs-ishii.system`);
        ics.push(`DTSTAMP:${formatDate(new Date().toISOString().split('T')[0])}T000000Z`);
        ics.push(`DTSTART;VALUE=DATE:${start}`);
        ics.push(`DTEND;VALUE=DATE:${end}`);
        ics.push(`SUMMARY:${summary}`);
        ics.push(`DESCRIPTION:${desc}`);
        ics.push('STATUS:CONFIRMED');
        ics.push('END:VEVENT');
    });

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
}

module.exports = {
    generateGoogleCalendarUrl,
    generateIcsFeed
};
