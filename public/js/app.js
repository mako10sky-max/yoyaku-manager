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
        'website': { label: '自社サイト', colorClass: '' },
        'ota': { label: 'OTA', colorClass: '' },
        'phone': { label: '電話', colorClass: 'phone' },
        'email': { label: 'メール', colorClass: 'email' },
        'line': { label: 'LINE', colorClass: 'line' },
        'other': { label: 'その他', colorClass: '' }
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
        document.getElementById(viewId).classList.add('active');
        
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

    getBadgeHtml(type, value) {
        if (type === 'status') {
            const info = this.statusMap[value] || { label: value, colorClass: '' };
            return `<span class="badge badge-status ${info.colorClass}">${info.label}</span>`;
        } else if (type === 'source') {
            const info = this.sourceMap[value] || { label: value, colorClass: '' };
            return `<span class="badge badge-source ${info.colorClass}">${info.label}</span>`;
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
