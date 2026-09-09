const dashboard = {
    async loadDashboard() {
        const statsContainer = document.getElementById('dashboard-stats');
        const recentContainer = document.getElementById('dashboard-recent');
        
        statsContainer.innerHTML = app.getSpinnerHtml();
        recentContainer.innerHTML = app.getSpinnerHtml();

        const statsData = await app.apiGet('/api/reservations/stats');

        if (statsData && statsData.success) {
            const d = statsData.data;
            statsContainer.innerHTML = `
                <div class="stat-card glass-card">
                    <span class="stat-icon">👋</span>
                    <span class="stat-value">${d.checkInsToday || 0}</span>
                    <span class="stat-label">本日チェックイン</span>
                </div>
                <div class="stat-card glass-card">
                    <span class="stat-icon">🛫</span>
                    <span class="stat-value">${d.checkOutsToday || 0}</span>
                    <span class="stat-label">本日チェックアウト</span>
                </div>
                <div class="stat-card glass-card">
                    <span class="stat-icon">📅</span>
                    <span class="stat-value">${d.bookingsThisMonth || 0}</span>
                    <span class="stat-label">今月予約数</span>
                </div>
                <div class="stat-card glass-card">
                    <span class="stat-icon">⏳</span>
                    <span class="stat-value">${(d.statusCounts && d.statusCounts.tentative) || 0}</span>
                    <span class="stat-label">仮予約</span>
                </div>
            `;
        }

        const recentData = await app.apiGet('/api/reservations/recent?limit=5');

        if (recentData && recentData.success && recentData.data.length > 0) {
            recentContainer.innerHTML = recentData.data.map(res => `
                <div class="res-card glass-card" onclick="reservations.openDetail(${res.id})">
                    <div class="res-card-header">
                        <span class="res-guest">${res.guest_name}様</span>
                        <div class="badges-wrap">
                            ${res.room_number ? `<span class="badge" style="background:rgba(129,140,248,0.2); color:#a5b4fc; font-weight:bold;">🚪 ${res.room_number}号室</span>` : ''}
                            ${app.getBadgeHtml('status', res.status)}
                            ${app.getBadgeHtml('source', res.source)}
                        </div>
                    </div>
                    <div class="res-dates">
                        <span>🗓 ${app.formatDate(res.check_in)} - ${app.formatDate(res.check_out)} (${res.num_guests || 1}名)</span>
                    </div>
                </div>
            `).join('');
        } else {
            recentContainer.innerHTML = app.getEmptyStateHtml('最近の予約はありません');
        }
    }
};
