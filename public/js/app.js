const app = {
    currentView: 'view-dashboard',
    
    // Status translation map
    statusMap: {
        'confirmed': { label: '確定', colorClass: 'confirmed' },
        'tentative': { label: '仮予約', colorClass: 'tentative' },
        'cancelled': { label: 'キャンセル', colorClass: 'cancelled' }
    },

    // Source translation map
    sourceMap: {
        'line': { label: 'LINE', colorClass: 'line' },
        'email': { label: 'Mail', colorClass: 'email' },
        'front': { label: '店頭', colorClass: 'front' },
        'phone': { label: '電話', colorClass: 'phone' },
        'website': { label: '自社サイト', colorClass: '' },
        'ota': { label: 'OTA', colorClass: '' },
        'other': { label: 'その他', colorClass: '' }
    },

    // Price Tier translation map
    priceTierMap: {
        'general': { label: '一般', colorClass: 'tier-general' },
        's_guest': { label: '⭐ Sゲスト', colorClass: 'tier-sguest' },
        'unconfirmed': { label: '⚠️ 要確認', colorClass: 'tier-unconfirmed' }
    },

    // Allergy status map
    allergyStatusMap: {
        'none': { label: 'アレルギーなし', colorClass: 'allergy-none' },
        'has': { label: '⚠️ アレルギーあり', colorClass: 'allergy-has' },
        'unconfirmed': { label: '⚠️ 要確認', colorClass: 'allergy-unconfirmed' }
    },
    
    init() {
        this.setupNavigation();
        this.navigateTo('view-dashboard');
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                this.navigateTo(targetId);
            });
        });
    },

    navigateTo(viewId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        // Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add('active');
        
        // Update Bottom Nav
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.target === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        this.currentView = viewId;

        // Trigger specific logic based on view
        if (viewId === 'view-dashboard' && typeof dashboard !== 'undefined') {
            dashboard.loadDashboard();
        } else if (viewId === 'view-list' && typeof reservations !== 'undefined') {
            reservations.loadReservations();
        } else if (viewId === 'view-calendar' && typeof calendarView !== 'undefined') {
            calendarView.loadCalendar();
        }
    },

    // API Helpers
    async apiGet(url) {
        try {
            const res = await fetch(url);
            return await res.json();
        } catch (err) {
            console.error('API GET Error:', err);
            return { success: false, error: '通信エラーが発生しました' };
        }
    },
    async apiPost(url, data) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (err) {
            console.error('API POST Error:', err);
            return { success: false, error: '通信エラーが発生しました' };
        }
    },
    async apiPut(url, data) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (err) {
            console.error('API PUT Error:', err);
            return { success: false, error: '通信エラーが発生しました' };
        }
    },
    async apiDelete(url) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            return await res.json();
        } catch (err) {
            console.error('API DELETE Error:', err);
            return { success: false, error: '通信エラーが発生しました' };
        }
    },

    // UI Helpers
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('closing');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    },

    formatDateWithDay(dateString) {
        if (!dateString) return '未設定';
        // YYYY-MM-DD をパース
        const parts = dateString.split('-');
        if (parts.length < 3) return dateString;
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayName = days[d.getDay()];
        return `${parts[0]}/${parts[1]}/${parts[2]}(${dayName})`;
    },

    // ①〜⑤の未確認チェック
    getUnconfirmedItems(r) {
        const unconfirmed = [];

        // ① 宿泊者氏名 / 予約者氏名
        if (!r.guest_name || r.guest_name.trim() === '') {
            unconfirmed.push('宿泊者名');
        }
        if (!r.booker_name || r.booker_name.trim() === '' || r.booker_name === '未確認') {
            unconfirmed.push('予約者名');
        }

        // ② 宿泊日程
        if (!r.check_in || !r.check_out || r.check_in.trim() === '' || r.check_out.trim() === '') {
            unconfirmed.push('宿泊日程');
        }

        // ③ 部屋番号 / 人数
        if (!r.room_number || r.room_number.trim() === '' || r.room_number === '未定') {
            unconfirmed.push('部屋番号');
        }
        if (!r.num_guests || r.num_guests <= 0) {
            unconfirmed.push('人数');
        }

        // ④ 価格対象 (一般 / Sゲスト)
        if (!r.price_tier || r.price_tier === 'unconfirmed' || r.price_tier === '未確認' || r.price_tier.trim() === '') {
            unconfirmed.push('価格対象');
        }

        // ⑤ アレルギー
        if (!r.allergy_status || r.allergy_status === 'unconfirmed' || r.allergy_status === '未確認' || r.allergy_status.trim() === '') {
            unconfirmed.push('アレルギー');
        }

        return unconfirmed;
    },

    getBadgeHtml(type, value) {
        if (type === 'status') {
            const info = this.statusMap[value] || { label: value, colorClass: '' };
            return `<span class="badge badge-status ${info.colorClass}">${info.label}</span>`;
        } else if (type === 'source') {
            const info = this.sourceMap[value] || { label: value, colorClass: '' };
            return `<span class="badge badge-source ${info.colorClass}">${info.label}</span>`;
        } else if (type === 'price_tier') {
            const info = this.priceTierMap[value] || { label: '⚠️ 要確認', colorClass: 'tier-unconfirmed' };
            return `<span class="badge badge-tier ${info.colorClass}">${info.label}</span>`;
        } else if (type === 'allergy_status') {
            const info = this.allergyStatusMap[value] || { label: '⚠️ 要確認', colorClass: 'allergy-unconfirmed' };
            return `<span class="badge badge-allergy ${info.colorClass}">${info.label}</span>`;
        }
        return '';
    },
    
    getSpinnerHtml() {
        return '<div class="spinner"></div>';
    },
    
    getEmptyStateHtml(message) {
        return `<div class="empty-state"><div class="icon">📭</div><p>${message}</p></div>`;
    },

    copyCalendarFeedUrl() {
        const feedUrl = `${window.location.origin}/api/calendar/feed.ics`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(feedUrl).then(() => {
                this.showToast('カレンダー同期URLをコピーしました！', 'success');
            }).catch(() => {
                prompt('以下のURLをコピーしてGoogleカレンダーに登録してください:', feedUrl);
            });
        } else {
            prompt('以下のURLをコピーしてGoogleカレンダーに登録してください:', feedUrl);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
