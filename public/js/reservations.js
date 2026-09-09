const reservations = {
    isEditing: false,

    init() {
        this.setupFilters();
        this.setupForm();
        this.setupEditToggle();
    },

    setupEditToggle() {
        const btn = document.getElementById('btn-edit-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!this.currentId) return;
            this.isEditing = !this.isEditing;
            btn.textContent = this.isEditing ? 'キャンセル' : '編集';
            this.loadReservationDetail(this.currentId);
        });
    },

    setupFilters() {
        const s = document.getElementById('filter-search');
        const st = document.getElementById('filter-status');
        const so = document.getElementById('filter-source');
        
        const trigger = () => this.loadReservations();
        s?.addEventListener('input', trigger);
        st?.addEventListener('change', trigger);
        so?.addEventListener('change', trigger);
    },

    async loadReservations() {
        const container = document.getElementById('reservation-list');
        container.innerHTML = app.getSpinnerHtml();

        const search = document.getElementById('filter-search')?.value || '';
        const status = document.getElementById('filter-status')?.value || '';
        const source = document.getElementById('filter-source')?.value || '';

        const res = await app.apiGet(`/api/reservations?search=${encodeURIComponent(search)}&status=${status}&source=${source}`);

        if (!res || !res.success || !res.data || res.data.length === 0) {
            container.innerHTML = app.getEmptyStateHtml('条件に一致する予約が見つかりません');
            return;
        }

        const data = res.data;
        const roomTypeMap = { 'single': 'シングル', 'double': 'ダブル', 'twin': 'ツイン', 'suite': 'スイート', 'family': 'ファミリー', 'other': 'その他' };

        container.innerHTML = data.map(r => `
            <div class="res-card glass-card" onclick="reservations.openDetail(${r.id})">
                <div class="res-card-header">
                    <span class="res-guest">${r.guest_name}様</span>
                    <div class="badges-wrap">
                        ${(r.has_allergy || r.allergies) ? `<span class="badge" style="background:rgba(248,113,113,0.25); color:#f87171; font-weight:bold; font-size:0.9rem;">⚠️ アレルギーあり</span>` : ''}
                        ${r.room_number ? `<span class="badge" style="background:rgba(129,140,248,0.25); color:#a5b4fc; font-weight:bold; font-size:0.95rem;">🚪 ${r.room_number}号室</span>` : ''}
                        ${app.getBadgeHtml('status', r.status)}
                        ${app.getBadgeHtml('source', r.source)}
                    </div>
                </div>
                <div class="res-dates">
                    <span>🗓 ${app.formatDate(r.check_in)} - ${app.formatDate(r.check_out)}</span>
                </div>
                <div class="res-meta">
                    <span>👤 ${r.num_guests || 1}名</span>
                    <span>🛏 ${r.room_number ? `${r.room_number}号室` : (roomTypeMap[r.room_type] || r.room_type || '標準')}</span>
                </div>
            </div>
        `).join('');
    },

    setupForm() {
        const form = document.getElementById('form-add-reservation');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const checkIn = document.getElementById('add-check-in').value;
            const checkOut = document.getElementById('add-check-out').value;

            if (new Date(checkIn) >= new Date(checkOut)) {
                app.showToast('チェックアウト日はチェックイン日より後にしてください', 'error');
                return;
            }

            const hasAllergyVal = document.getElementById('add-has-allergy')?.value === '1';

            const data = {
                guest_name: document.getElementById('add-guest-name').value,
                booker_name: document.getElementById('add-booker-name').value,
                check_in: checkIn,
                check_out: checkOut,
                num_guests: parseInt(document.getElementById('add-num-guests').value, 10),
                room_type: document.getElementById('add-room-type').value,
                room_number: document.getElementById('add-room-number')?.value || '',
                price: parseInt(document.getElementById('add-price').value, 10) || 0,
                contact: document.getElementById('add-contact').value,
                has_allergy: hasAllergyVal,
                allergies: hasAllergyVal ? document.getElementById('add-allergies').value : '',
                status: document.getElementById('add-status').value,
                source: document.getElementById('add-source').value,
                notes: document.getElementById('add-notes').value
            };

            const res = await app.apiPost('/api/reservations', data);

            if (res && res.success) {
                app.showToast('予約を追加しました', 'success');
                form.reset();
                app.navigateTo('view-list');
            } else {
                app.showToast((res && res.error) || '追加に失敗しました', 'error');
            }
        });
    },

    async openDetail(id) {
        this.currentId = id;
        this.isEditing = false;
        const btn = document.getElementById('btn-edit-toggle');
        if (btn) btn.textContent = '編集';
        app.navigateTo('view-detail');
        await this.loadReservationDetail(id);
    },

    async loadReservationDetail(id) {
        const container = document.getElementById('detail-content');
        container.innerHTML = app.getSpinnerHtml();

        const res = await app.apiGet(`/api/reservations/${id}`);

        if (res && res.success && res.data) {
            const d = res.data;
            const roomTypeMap = { 'single': 'シングル', 'double': 'ダブル', 'twin': 'ツイン', 'suite': 'スイート', 'family': 'ファミリー', 'other': 'その他' };

            if (this.isEditing) {
                // 編集フォームのレンダリング
                container.innerHTML = `
                    <form id="form-edit-reservation" class="glass-card detail-container" onsubmit="reservations.saveEdit(event)">
                        <div class="form-group">
                            <label>ゲスト名 <span class="required">*</span></label>
                            <input type="text" id="edit-guest-name" value="${d.guest_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>部屋番号 (例: 202)</label>
                            <input type="text" id="edit-room-number" value="${d.room_number || ''}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>チェックイン <span class="required">*</span></label>
                                <input type="date" id="edit-check-in" value="${d.check_in}" required>
                            </div>
                            <div class="form-group">
                                <label>チェックアウト <span class="required">*</span></label>
                                <input type="date" id="edit-check-out" value="${d.check_out}" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>宿泊人数</label>
                                <input type="number" id="edit-num-guests" value="${d.num_guests || 1}" min="1">
                            </div>
                            <div class="form-group">
                                <label>料金 (円)</label>
                                <input type="number" id="edit-price" value="${d.price || 0}">
                            </div>
                        </div>
                        
                        <!-- アレルギー設定 -->
                        <div class="form-group">
                            <label style="font-weight:bold;">アレルギーの有無</label>
                            <select id="edit-has-allergy" onchange="document.getElementById('edit-allergy-detail-wrap').style.display = this.value === '1' ? 'block' : 'none'">
                                <option value="0" ${!d.has_allergy ? 'selected' : ''}>なし</option>
                                <option value="1" ${d.has_allergy ? 'selected' : ''}>あり ⚠️</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit-allergy-detail-wrap" style="display: ${d.has_allergy ? 'block' : 'none'};">
                            <label style="color:var(--danger); font-weight:bold;">⚠️ アレルギー詳細内容</label>
                            <input type="text" id="edit-allergies" value="${d.allergies || ''}" placeholder="例: エビ・カニ、そば、卵">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>ステータス</label>
                                <select id="edit-status">
                                    <option value="confirmed" ${d.status === 'confirmed' ? 'selected' : ''}>確定</option>
                                    <option value="tentative" ${d.status === 'tentative' ? 'selected' : ''}>仮予約</option>
                                    <option value="cancelled" ${d.status === 'cancelled' ? 'selected' : ''}>キャンセル</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>予約経路</label>
                                <select id="edit-source">
                                    <option value="line" ${d.source === 'line' ? 'selected' : ''}>LINE</option>
                                    <option value="phone" ${d.source === 'phone' ? 'selected' : ''}>電話</option>
                                    <option value="email" ${d.source === 'email' ? 'selected' : ''}>メール</option>
                                    <option value="website" ${d.source === 'website' ? 'selected' : ''}>自社サイト</option>
                                    <option value="ota" ${d.source === 'ota' ? 'selected' : ''}>OTA</option>
                                    <option value="other" ${d.source === 'other' ? 'selected' : ''}>その他</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>連絡先</label>
                            <input type="text" id="edit-contact" value="${d.contact || ''}">
                        </div>
                        <div class="form-group">
                            <label>社内メモ / メッセージ本文</label>
                            <textarea id="edit-notes" rows="4">${d.notes || ''}</textarea>
                        </div>
                        <div class="form-actions" style="margin-top:1rem;">
                            <button type="submit" class="btn-primary">変更を保存する</button>
                        </div>
                    </form>
                `;
            } else {
                // 閲覧モードのレンダリング
                container.innerHTML = `
                    <div class="glass-card detail-container">
                        <div class="detail-item">
                            <div class="detail-label">ステータス / 経路 / 部屋</div>
                            <div class="badges-wrap" style="margin-top:0.25rem;">
                                ${(d.has_allergy || d.allergies) ? `<span class="badge" style="background:rgba(248,113,113,0.25); color:#f87171; font-weight:bold; font-size:0.95rem;">⚠️ アレルギーあり</span>` : ''}
                                ${d.room_number ? `<span class="badge" style="background:rgba(129,140,248,0.25); color:#a5b4fc; font-weight:bold; font-size:0.95rem;">🚪 ${d.room_number}号室</span>` : ''}
                                ${app.getBadgeHtml('status', d.status)}
                                ${app.getBadgeHtml('source', d.source)}
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">ゲスト名</div>
                            <div class="detail-val" style="font-size:1.3rem; font-weight:bold;">${d.guest_name}様</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">部屋番号</div>
                            <div class="detail-val" style="color:#a5b4fc; font-weight:bold;">${d.room_number ? `${d.room_number}号室` : '未設定'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">アレルギー有無・詳細</div>
                            <div class="detail-val" style="color:${(d.has_allergy || d.allergies) ? '#f87171' : '#fff'}; font-weight:bold;">
                                ${(d.has_allergy || d.allergies) ? `⚠️ あり: ${d.allergies || '詳細未入力'}` : '✅ なし'}
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">日程</div>
                            <div class="detail-val">${app.formatDate(d.check_in)} 〜 ${app.formatDate(d.check_out)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">人数 / 部屋タイプ</div>
                            <div class="detail-val">${d.num_guests || 1}名 / ${roomTypeMap[d.room_type] || d.room_type || '標準'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">料金</div>
                            <div class="detail-val">¥${(d.price || 0).toLocaleString()}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">連絡先</div>
                            <div class="detail-val">${d.contact || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">社内メモ / LINE受信用メッセージ</div>
                            <div class="detail-val" style="white-space: pre-wrap; background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:8px;">${d.notes || '-'}</div>
                        </div>
                        <div class="detail-item" style="padding-top:1rem;">
                            <button class="btn-primary" style="background:linear-gradient(135deg, #4285F4, #34A853); display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="reservations.openGoogleCalendar(${d.id})">
                                <span>📅 Googleカレンダーに追加</span>
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            container.innerHTML = app.getEmptyStateHtml('データが見つかりません');
        }
    },

    async saveEdit(e) {
        e.preventDefault();
        if (!this.currentId) return;

        const hasAllergyVal = document.getElementById('edit-has-allergy')?.value === '1';

        const updateData = {
            guest_name: document.getElementById('edit-guest-name').value,
            room_number: document.getElementById('edit-room-number').value,
            check_in: document.getElementById('edit-check-in').value,
            check_out: document.getElementById('edit-check-out').value,
            num_guests: parseInt(document.getElementById('edit-num-guests').value, 10),
            price: parseInt(document.getElementById('edit-price').value, 10) || 0,
            has_allergy: hasAllergyVal,
            allergies: hasAllergyVal ? document.getElementById('edit-allergies').value : '',
            status: document.getElementById('edit-status').value,
            source: document.getElementById('edit-source').value,
            contact: document.getElementById('edit-contact').value,
            notes: document.getElementById('edit-notes').value
        };

        const res = await app.apiPut(`/api/reservations/${this.currentId}`, updateData);

        if (res && res.success) {
            app.showToast('予約情報を更新しました', 'success');
            this.isEditing = false;
            const btn = document.getElementById('btn-edit-toggle');
            if (btn) btn.textContent = '編集';
            await this.loadReservationDetail(this.currentId);
        } else {
            app.showToast('更新に失敗しました', 'error');
        }
    },

    async deleteCurrent() {
        if (!this.currentId) return;
        if (!confirm('本当にこの予約を削除しますか？')) return;

        const res = await app.apiDelete(`/api/reservations/${this.currentId}`);

        if (res && res.success) {
            app.showToast('予約を削除しました', 'success');
            app.navigateTo('view-list');
        } else {
            app.showToast('削除に失敗しました', 'error');
        }
    },

    async openGoogleCalendar(id) {
        try {
            const res = await app.apiGet(`/api/calendar/url/${id}`);
            if (res && res.success && res.url) {
                window.open(res.url, '_blank');
            } else {
                app.showToast('カレンダーURLの生成に失敗しました', 'error');
            }
        } catch (e) {
            console.error(e);
            app.showToast('カレンダー連携エラー', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    reservations.init();
});
