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

    STORAGE_KEY: 'yoyaku_reservations_backup_v1',

    // ローカルストレージからバックアップ取得
    getLocalBackup() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to get local backup:', e);
            return [];
        }
    },

    // ローカルストレージにバックアップ保存
    saveLocalBackup(list) {
        try {
            if (Array.isArray(list)) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            }
        } catch (e) {
            console.error('Failed to save local backup:', e);
        }
    },

    // 予約1件の追加/更新をバックアップに反映
    upsertLocalBackup(item) {
        if (!item || !item.id) return;
        const list = this.getLocalBackup();
        const idx = list.findIndex(r => r.id === item.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...item };
        } else {
            list.unshift(item);
        }
        this.saveLocalBackup(list);
    },

    // 予約1件の削除をバックアップに反映
    removeLocalBackup(id) {
        const list = this.getLocalBackup();
        const filtered = list.filter(r => r.id !== id);
        this.saveLocalBackup(filtered);
    },

    // サーバーとの双方向同期（Renderサーバー再起動・スリープ復旧時の自動リストア）
    async syncWithServer() {
        try {
            const res = await this.apiGet('/api/reservations');
            if (!res || !res.success || !Array.isArray(res.data)) return null;

            const serverList = res.data;
            const localList = this.getLocalBackup();

            // ローカルストレージにサーバーにない予約があるか確認
            const serverIds = new Set(serverList.map(r => r.id));
            const missingOnServer = localList.filter(l => !serverIds.has(l.id));

            if (missingOnServer.length > 0) {
                // サーバー再起動等でデータが消えていた場合、ローカルから全予約を自動リストア！
                console.log(`サーバーに未同期の予約 ${missingOnServer.length}件 を自動復元同期します`);
                const syncRes = await this.apiPost('/api/reservations/sync', { items: localList });
                if (syncRes && syncRes.success && Array.isArray(syncRes.data)) {
                    this.saveLocalBackup(syncRes.data);
                    this.showToast(`保存済み予約 ${missingOnServer.length}件 を自動復元しました`, 'info');
                    return syncRes.data;
                }
            } else if (serverList.length > 0) {
                // サーバーの最新一覧をローカルバックアップに保存
                this.saveLocalBackup(serverList);
            }
            return serverList;
        } catch (e) {
            console.error('Sync error:', e);
            return null;
        }
    },
    
    async init() {
        this.setupNavigation();
        // 起動時にサーバーとローカルストレージを同期（データ消失防止）
        await this.syncWithServer();
        this.navigateTo('view-dashboard');

        // タブに復帰した際にもバックグラウンドで同期
        window.addEventListener('focus', () => {
            this.syncWithServer();
        });
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
    },

    // 予約データをJSONファイルとしてダウンロード保存
    async exportBackupJson() {
        try {
            const res = await this.apiGet('/api/reservations');
            const list = (res && res.success && res.data) ? res.data : this.getLocalBackup();
            if (!list || list.length === 0) {
                this.showToast('バックアップする予約データがありません', 'warning');
                return;
            }
            const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `yoyaku_backup_${now}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast(`予約データ(${list.length}件)をバックアップ保存しました`, 'success');
        } catch (e) {
            console.error(e);
            this.showToast('バックアップ保存に失敗しました', 'error');
        }
    },

    // JSONバックアップファイルからデータを復元
    async importBackupJson(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const list = JSON.parse(e.target.result);
                if (!Array.isArray(list) || list.length === 0) {
                    this.showToast('有効な予約バックアップファイルではありません', 'error');
                    return;
                }
                const res = await this.apiPost('/api/reservations/sync', { items: list });
                if (res && res.success) {
                    this.saveLocalBackup(res.data);
                    this.showToast(`バックアップから ${list.length}件の予約を復元しました！`, 'success');
                    if (typeof reservations !== 'undefined') reservations.loadReservations();
                    if (typeof dashboard !== 'undefined') dashboard.loadDashboard();
                } else {
                    this.showToast('サーバーへの復元に失敗しました', 'error');
                }
            } catch (err) {
                console.error(err);
                this.showToast('ファイル読み込みエラー: JSON形式が不正です', 'error');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
