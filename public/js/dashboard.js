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
                <div class="stat-card glass-card ${d.unconfirmedCount > 0 ? 'stat-card-warn' : ''}" style="cursor:pointer;" onclick="reservations.filterOnlyUnconfirmed=true; const b=document.getElementById('filter-btn-unconfirmed'); if(b) b.classList.add('active'); app.navigateTo('view-list');">
                    <span class="stat-icon">${d.unconfirmedCount > 0 ? '⚠️' : '⏳'}</span>
                    <span class="stat-value" style="${d.unconfirmedCount > 0 ? 'color:var(--danger);' : ''}">${d.unconfirmedCount || 0}</span>
                    <span class="stat-label">${d.unconfirmedCount > 0 ? '要確認の予約 (タップ)' : '要確認なし'}</span>
                </div>
            `;
        }

        const recentData = await app.apiGet('/api/reservations/recent?limit=5');

        if (recentData && recentData.success && recentData.data.length > 0) {
            recentContainer.innerHTML = recentData.data.map(res => {
                const unconfirmed = app.getUnconfirmedItems(res);
                const hasWarning = unconfirmed.length > 0;
                
                return `
                    <div class="res-card glass-card ${hasWarning ? 'has-unconfirmed-border' : ''}" onclick="reservations.openDetail(${res.id})">
                        <div class="res-card-header">
                            <div class="badges-wrap" style="width:100%; justify-content:space-between; margin-bottom:0.25rem;">
                                <div style="display:flex; gap:0.4rem; align-items:center;">
                                    ${app.getBadgeHtml('source', res.source)}
                                    ${app.getBadgeHtml('price_tier', res.price_tier)}
                                </div>
                                ${hasWarning ? `<span class="badge badge-warn-pill">⚠️ 要確認: ${unconfirmed.join('・')}</span>` : '<span class="badge badge-ok-pill">✅ 確認済</span>'}
                            </div>
                        </div>
                        <div class="res-field-row name-row">
                            <div class="field-item">
                                <span class="field-label">① 宿泊者</span>
                                <span class="field-val-main">👤 ${res.guest_name} 様</span>
                            </div>
                            <div class="field-item booker-item">
                                <span class="field-label">予約者</span>
                                <span class="field-val-sub">🤝 ${res.booker_name ? `${res.booker_name} 様` : '<span class="warn-badge">要確認⚠️</span>'}</span>
                            </div>
                        </div>
                        <div class="res-dates" style="margin-top:0.35rem;">
                            <span>📅 ${app.formatDateWithDay(res.check_in)} 〜 ${app.formatDateWithDay(res.check_out)}</span>
                        </div>
                        <div class="res-meta" style="margin-top:0.35rem;">
                            <span>🚪 ${res.room_number ? `${res.room_number}号室` : '<span class="warn-text">部屋未定⚠️</span>'}</span>
                            <span>👥 ${res.num_guests || 1}名</span>
                            <span>${(res.allergy_status === 'has' || res.has_allergy === 1) ? '<span style="color:var(--danger); font-weight:bold;">🚨 アレルギーあり</span>' : (res.allergy_status === 'none' ? 'アレルギーなし' : '<span class="warn-text">アレルギー要確認⚠️</span>')}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            recentContainer.innerHTML = app.getEmptyStateHtml('最近の予約はありません');
        }
    }
};
