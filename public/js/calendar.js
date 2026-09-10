const calendarView = {
    currentDate: new Date(),
    selectedDateStr: null,
    reservations: [],

    init() {
        this.selectedDateStr = this.formatDateYMD(this.currentDate);
    },

    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.loadCalendar();
    },

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.loadCalendar();
    },

    todayMonth() {
        this.currentDate = new Date();
        this.selectedDateStr = this.formatDateYMD(this.currentDate);
        this.loadCalendar();
    },

    formatDateYMD(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    async loadCalendar() {
        const grid = document.getElementById('calendar-grid');
        const headerTitle = document.getElementById('calendar-month-title');
        const dayEventsContainer = document.getElementById('calendar-day-events');
        
        if (!grid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth(); // 0-indexed

        if (headerTitle) {
            headerTitle.textContent = `${year}年 ${month + 1}月`;
        }

        grid.innerHTML = app.getSpinnerHtml();

        const dateFrom = new Date(year, month - 1, 20).toISOString().split('T')[0];
        const dateTo = new Date(year, month + 1, 10).toISOString().split('T')[0];

        const res = await app.apiGet(`/api/reservations?date_from=${dateFrom}&date_to=${dateTo}`);
        this.reservations = (res && res.success && res.data) ? res.data : [];

        this.renderGrid(year, month);
        this.renderSelectedDayEvents();
    },

    renderGrid(year, month) {
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;

        const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        const todayStr = this.formatDateYMD(new Date());

        let html = '';

        // 曜日ヘッダー
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        html += `<div class="cal-weekdays">` + dayNames.map((d, i) => `
            <div class="cal-weekday ${i === 0 ? 'sun' : (i === 6 ? 'sat' : '')}">${d}</div>
        `).join('') + `</div>`;

        html += `<div class="cal-days-grid">`;

        // 前月の余白
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayNum = prevMonthLastDay - i;
            html += `<div class="cal-day other-month"><span class="day-number">${dayNum}</span></div>`;
        }

        // 当月の日付
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month, day).getDay();
            
            // この日に宿泊している予約を抽出 (check_in <= date < check_out)
            const dayReservations = this.reservations.filter(r => {
                if (r.status === 'cancelled') return false;
                return r.check_in <= dateStr && dateStr < r.check_out;
            });

            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.selectedDateStr;
            const hasUnconfirmed = dayReservations.some(r => app.getUnconfirmedItems(r).length > 0);

            html += `
                <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayOfWeek === 0 ? 'sun' : (dayOfWeek === 6 ? 'sat' : '')}"
                     onclick="calendarView.selectDate('${dateStr}')">
                    <div class="day-header">
                        <span class="day-number">${day}</span>
                        ${hasUnconfirmed ? `<span class="cal-warn-dot" title="要確認あり">⚠️</span>` : ''}
                    </div>
                    <div class="day-res-chips">
                        ${dayReservations.slice(0, 2).map(r => `
                            <div class="cal-chip ${r.status === 'tentative' ? 'tentative' : ''}" title="${r.guest_name}様 (${r.room_number || '未定'})">
                                <span class="chip-room">${r.room_number ? `${r.room_number}` : '?'}</span>
                                <span class="chip-name">${r.guest_name}</span>
                            </div>
                        `).join('')}
                        ${dayReservations.length > 2 ? `<div class="cal-chip-more">+${dayReservations.length - 2}件</div>` : ''}
                    </div>
                </div>
            `;
        }

        // 次月の余白
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="cal-day other-month"><span class="day-number">${i}</span></div>`;
        }

        html += `</div>`;
        grid.innerHTML = html;
    },

    selectDate(dateStr) {
        this.selectedDateStr = dateStr;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        this.renderGrid(year, month);
        this.renderSelectedDayEvents();
    },

    renderSelectedDayEvents() {
        const container = document.getElementById('calendar-day-events');
        if (!container) return;

        if (!this.selectedDateStr) {
            container.innerHTML = '<p class="text-muted" style="padding:1rem; text-align:center;">カレンダーの日付を選択してください</p>';
            return;
        }

        const dateStr = this.selectedDateStr;
        const dayReservations = this.reservations.filter(r => {
            if (r.status === 'cancelled') return false;
            return r.check_in <= dateStr && dateStr < r.check_out;
        });

        const formattedSelected = app.formatDateWithDay(dateStr);

        if (dayReservations.length === 0) {
            container.innerHTML = `
                <div class="day-events-header">
                    <h4>📅 ${formattedSelected} の宿泊状況</h4>
                </div>
                <div style="padding:1.5rem; text-align:center; color:var(--text-muted);">
                    <div style="font-size:1.5rem; margin-bottom:0.25rem;">🛏️</div>
                    この日の宿泊予約はありません（空室）
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="day-events-header">
                <h4>📅 ${formattedSelected} の宿泊状況 (${dayReservations.length}部屋)</h4>
            </div>
            <div class="day-events-list">
                ${dayReservations.map(r => {
                    const unconfirmed = app.getUnconfirmedItems(r);
                    return `
                        <div class="res-card glass-card" style="padding:0.85rem; margin-bottom:0.75rem;" onclick="reservations.openDetail(${r.id})">
                            <div class="res-card-header">
                                <div>
                                    <span class="res-guest" style="font-size:1.05rem;">👤 宿泊者: ${r.guest_name}様</span>
                                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">
                                        🤝 予約者: ${r.booker_name || '<span style="color:var(--danger); font-weight:bold;">⚠️ 要確認</span>'}
                                    </div>
                                </div>
                                <div class="badges-wrap">
                                    ${r.room_number ? `<span class="badge" style="background:rgba(129,140,248,0.25); color:#a5b4fc; font-weight:bold;">🚪 ${r.room_number}号室</span>` : '<span class="badge badge-status cancelled">⚠️ 部屋未定</span>'}
                                    ${app.getBadgeHtml('price_tier', r.price_tier)}
                                    ${app.getBadgeHtml('source', r.source)}
                                </div>
                            </div>
                            <div class="res-meta" style="margin-top:0.5rem; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.5rem;">
                                <span>👥 ${r.num_guests || 1}名 | 🗓 ${app.formatDate(r.check_in)}〜${app.formatDate(r.check_out)}</span>
                                ${unconfirmed.length > 0 ? `<span class="badge badge-status cancelled">⚠️ 要確認: ${unconfirmed.join('・')}</span>` : '<span class="badge badge-status confirmed">✅ 確認済</span>'}
                            </div>
                            <div class="res-card-quick-bar" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; padding-top:0.45rem; border-top:1px solid rgba(255,255,255,0.06);">
                                <span style="font-size:0.75rem; color:var(--text-muted);">タップして詳細確認</span>
                                <button type="button" class="btn-quick-edit" onclick="event.stopPropagation(); reservations.openEditDirect(${r.id});" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.35rem 0.8rem; font-size:0.82rem; font-weight:700; color:#fff; background:linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.35)); border:1px solid rgba(129,140,248,0.5); border-radius:8px; cursor:pointer;">
                                    <span>✏️</span> <span>変更・編集</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    calendarView.init();
});