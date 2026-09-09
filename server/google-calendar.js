/**
 * Google Calendar 連携モジュール
 */

// Googleカレンダー登録用ワンクリックURLの生成
function generateGoogleCalendarUrl(reservation) {
    const { guest_name, booker_name, check_in, check_out, num_guests, room_number, price_tier, allergy_status, allergies, notes, contact } = reservation;
    
    // 宿泊タイトル
    const roomText = room_number ? `${room_number}号室` : '⚠️部屋未定';
    const tierText = price_tier === 's_guest' ? '[Sゲスト]' : (price_tier === 'general' ? '[一般]' : '[価格要確認]');
    const bookerText = booker_name && booker_name !== guest_name ? ` (予約:${booker_name})` : '';
    const title = encodeURIComponent(`【宿泊】${guest_name}様${bookerText} (${roomText}) ${tierText}`);
    
    // 日付フォーマット (YYYYMMDD)
    const startDate = check_in.replace(/-/g, '');
    const endDate = check_out.replace(/-/g, '');
    const dates = `${startDate}/${endDate}`;
    
    // 詳細説明
    let details = `■ 宿泊予約詳細\n`;
    details += `・宿泊者名: ${guest_name}様\n`;
    details += `・予約者名: ${booker_name || '未確認⚠️'}\n`;
    details += `・お部屋: ${roomText}\n`;
    details += `・宿泊人数: ${num_guests || 1}名\n`;
    details += `・価格対象: ${price_tier === 's_guest' ? 'Sゲスト ⭐' : (price_tier === 'general' ? '一般' : '要確認 ⚠️')}\n`;
    
    if (allergy_status === 'has' || allergies) {
        details += `・アレルギー: ⚠️あり (${allergies || '詳細確認要'})\n`;
    } else if (allergy_status === 'none') {
        details += `・アレルギー: なし\n`;
    } else {
        details += `・アレルギー: ⚠️未確認\n`;
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

        const roomText = r.room_number ? `${r.room_number}号室` : '⚠️部屋未定';
        const tierText = r.price_tier === 's_guest' ? '[Sゲスト]' : (r.price_tier === 'general' ? '[一般]' : '[要確認]');
        const bookerText = r.booker_name && r.booker_name !== r.guest_name ? ` (予約:${r.booker_name})` : '';
        const summary = `【宿泊】${r.guest_name}様${bookerText} (${roomText}) ${tierText}`;
        const start = formatDate(r.check_in);
        const end = formatDate(r.check_out);
        
        let desc = `宿泊者: ${r.guest_name}様\\n予約者: ${r.booker_name || '未確認⚠️'}\\n部屋: ${roomText}\\n人数: ${r.num_guests || 1}名\\n価格対象: ${r.price_tier === 's_guest' ? 'Sゲスト' : (r.price_tier === 'general' ? '一般' : '要確認⚠️')}`;
        
        if (r.allergy_status === 'has' || r.allergies) {
            desc += `\\nアレルギー: ⚠️あり (${r.allergies || '詳細確認要'})`;
        } else if (r.allergy_status === 'none') {
            desc += `\\nアレルギー: なし`;
        } else {
            desc += `\\nアレルギー: ⚠️未確認`;
        }

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
