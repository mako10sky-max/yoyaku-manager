const reservations = {
    isEditing: false,
    currentId: null,
    filterOnlyUnconfirmed: false,

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
        const tp = document.getElementById('filter-tier');
        const btnUnconfirmed = document.getElementById('filter-btn-unconfirmed');
        
        const trigger = () => this.loadReservations();
        s?.addEventListener('input', trigger);
        st?.addEventListener('change', trigger);
        so?.addEventListener('change', trigger);
        tp?.addEventListener('change', trigger);

        if (btnUnconfirmed) {
            btnUnconfirmed.addEventListener('click', () => {
                this.filterOnlyUnconfirmed = !this.filterOnlyUnconfirmed;
                btnUnconfirmed.classList.toggle('active', this.filterOnlyUnconfirmed);
                this.loadReservations();
            });
        }
    },

    copyGuestToBooker(prefix) {
        const guestInput = document.getElementById(`${prefix}-guest-name`);
        const bookerInput = document.getElementById(`${prefix}-booker-name`);
        if (guestInput && bookerInput) {
            bookerInput.value = guestInput.value;
            app.showToast('宿泊者名を予約者名にコピーしました', 'info');
        }
    },

    calculateNights(checkIn, checkOut) {
        if (!checkIn || !checkOut) return 1;
        const diff = new Date(checkOut) - new Date(checkIn);
        const nights = Math.round(diff / (1000 * 60 * 60 * 24));
        return nights > 0 ? nights : 1;
    },

    async loadReservations() {
        const container = document.getElementById('reservation-list');
        if (!container) return;
        container.innerHTML = app.getSpinnerHtml();

        const search = document.getElementById('filter-search')?.value || '';
        const status = document.getElementById('filter-status')?.value || '';
        const source = document.getElementById('filter-source')?.value || '';
        const tier = document.getElementById('filter-tier')?.value || '';

        let url = `/api/reservations?search=${encodeURIComponent(search)}&status=${status}&source=${source}`;
        if (tier) url += `&price_tier=${tier}`;

        const res = await app.apiGet(url);

        if (!res || !res.success || !res.data || res.data.length === 0) {
            container.innerHTML = app.getEmptyStateHtml('条件に一致する予約が見つかりません');
            return;
        }

        let data = res.data;

        // 要確認のみフィルタ
        if (this.filterOnlyUnconfirmed) {
            data = data.filter(r => app.getUnconfirmedItems(r).length > 0);
            if (data.length === 0) {
                container.innerHTML = app.getEmptyStateHtml('要確認の予約はありません（すべて確認済みです！）');
                return;
            }
        }

        container.innerHTML = data.map(r => {
            const unconfirmed = app.getUnconfirmedItems(r);
            const hasWarning = unconfirmed.length > 0;
            const nights = this.calculateNights(r.check_in, r.check_out);

            // ① 宿泊者 & 予約者
            const guestText = r.guest_name ? `${r.guest_name} 様` : '<span class="warn-text">未入力⚠️</span>';
            const bookerText = r.booker_name ? `${r.booker_name} 様` : '<span class="warn-badge">⚠️ 要確認</span>';

            // ② 宿泊カレンダー / 日程
            const datesText = (r.check_in && r.check_out)
                ? `${app.formatDateWithDay(r.check_in)} 〜 ${app.formatDateWithDay(r.check_out)} (${nights}泊)`
                : '<span class="warn-text">⚠️ 日程要確認</span>';

            // ③ 部屋番号、人数
            const roomText = r.room_number ? `${r.room_number}号室` : '<span class="warn-badge">🚪 未定</span>';
            const guestsText = r.num_guests ? `${r.num_guests}名` : '<span class="warn-text">⚠️</span>';

            // ④ 価格対象
            const tierBadge = app.getBadgeHtml('price_tier', r.price_tier);

            // ⑤ アレルギー
            let allergyDisplay = '';
            if (r.allergy_status === 'has' || r.has_allergy === 1) {
                allergyDisplay = `<span class="badge badge-allergy allergy-has">🚨 あり: ${r.allergies || '詳細確認要'}</span>`;
            } else if (r.allergy_status === 'none') {
                allergyDisplay = `<span class="badge badge-allergy allergy-none">✅ なし</span>`;
            } else {
                allergyDisplay = `<span class="badge badge-allergy allergy-unconfirmed">⚠️ 要確認</span>`;
            }

            // ⑥ 予約経路
            const sourceBadge = app.getBadgeHtml('source', r.source);
            const statusBadge = app.getBadgeHtml('status', r.status);

            // 要確認項目テキスト（短縮）
            const warnLabel = hasWarning
                ? `<span class="badge badge-warn-pill">⚠️ ${unconfirmed.join(' / ')}</span>`
                : `<span class="badge badge-ok-pill">✅ 確認済</span>`;

            return `
                <div class="res-card glass-card ${hasWarning ? 'has-unconfirmed-border' : ''}" onclick="reservations.openDetail(${r.id})">
                    <!-- ヘッダー：バッジ行 + 要確認ラベル -->
                    <div class="res-card-header">
                        <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
                            ${sourceBadge}${statusBadge}${tierBadge}
                        </div>
                        ${warnLabel}
                    </div>

                    <!-- ① 宿泊者氏名 & 予約者氏名 (縦積み) -->
                    <div class="res-field-row name-row">
                        <div class="field-item">
                            <span class="field-label">① 宿泊者</span>
                            <span class="field-val-main">👤 ${guestText}</span>
                        </div>
                        <div class="field-item booker-item">
                            <span class="field-label">予約者</span>
                            <span class="field-val-sub">🤝 ${bookerText}</span>
                        </div>
                    </div>

                    <!-- ② 宿泊日程 -->
                    <div class="res-field-row">
                        <div class="field-item" style="width:100%;">
                            <span class="field-label">② 宿泊日程</span>
                            <span class="field-val">📅 ${datesText}</span>
                        </div>
                    </div>

                    <!-- ③ 部屋番号、人数 -->
                    <div class="res-field-row room-guests-row">
                        <div class="field-item">
                            <span class="field-label">③ 部屋</span>
                            <span class="field-val">🚪 ${roomText}</span>
                        </div>
                        <div class="field-item">
                            <span class="field-label">人数</span>
                            <span class="field-val">👥 ${guestsText}</span>
                        </div>
                    </div>

                    <!-- ④ 価格対象 & ⑤ アレルギー -->
                    <div class="res-field-row allergy-tier-row">
                        <div class="field-item">
                            <span class="field-label">④ 価格</span>
                            <span class="field-val">${tierBadge}</span>
                        </div>
                        <div class="field-item">
                            <span class="field-label">⑤ アレルギー</span>
                            <span class="field-val">${allergyDisplay}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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

            const allergyStatus = document.getElementById('add-allergy-status')?.value || 'unconfirmed';
            const priceTier = document.getElementById('add-price-tier')?.value || 'unconfirmed';

            const data = {
                guest_name: document.getElementById('add-guest-name').value,
                booker_name: document.getElementById('add-booker-name').value,
                check_in: checkIn,
                check_out: checkOut,
                num_guests: parseInt(document.getElementById('add-num-guests').value, 10) || 1,
                room_number: document.getElementById('add-room-number')?.value || '',
                price_tier: priceTier,
                allergy_status: allergyStatus,
                has_allergy: allergyStatus === 'has' ? 1 : 0,
                allergies: allergyStatus === 'has' ? (document.getElementById('add-allergies')?.value || '') : '',
                price: parseInt(document.getElementById('add-price').value, 10) || 0,
                contact: document.getElementById('add-contact').value,
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
        if (!container) return;
        container.innerHTML = app.getSpinnerHtml();

        const res = await app.apiGet(`/api/reservations/${id}`);

        if (res && res.success && res.data) {
            const d = res.data;
            const unconfirmed = app.getUnconfirmedItems(d);
            const hasWarning = unconfirmed.length > 0;
            const nights = this.calculateNights(d.check_in, d.check_out);

            if (this.isEditing) {
                // 編集フォームのレンダリング
                container.innerHTML = `
                    <form id="form-edit-reservation" class="glass-card detail-container" onsubmit="reservations.saveEdit(event)">
                        <!-- ① 宿泊者氏名 ＆ 予約者氏名 -->
                        <div class="form-group">
                            <label>① 宿泊者氏名 <span class="required">*</span></label>
                            <input type="text" id="edit-guest-name" value="${d.guest_name || ''}" required placeholder="例: 山田 太郎">
                        </div>
                        <div class="form-group">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                <label style="margin-bottom:0;">予約者氏名</label>
                                <button type="button" class="btn-text-xs" onclick="reservations.copyGuestToBooker('edit')">宿泊者と同じにする</button>
                            </div>
                            <input type="text" id="edit-booker-name" value="${d.booker_name || ''}" placeholder="例: 鈴木 一郎 (未確認の場合は空欄)">
                        </div>

                        <!-- ② 宿泊カレンダー (日程) -->
                        <div class="form-row">
                            <div class="form-group">
                                <label>② チェックイン <span class="required">*</span></label>
                                <input type="date" id="edit-check-in" value="${d.check_in}" required>
                            </div>
                            <div class="form-group">
                                <label>チェックアウト <span class="required">*</span></label>
                                <input type="date" id="edit-check-out" value="${d.check_out}" required>
                            </div>
                        </div>

                        <!-- ③ 部屋番号、人数 -->
                        <div class="form-row">
                            <div class="form-group">
                                <label>③ 部屋番号 (例: 202, 貸切)</label>
                                <input type="text" id="edit-room-number" value="${d.room_number || ''}" placeholder="未定の場合は空欄">
                            </div>
                            <div class="form-group">
                                <label>宿泊人数</label>
                                <input type="number" id="edit-num-guests" value="${d.num_guests || 1}" min="1">
                            </div>
                        </div>

                        <!-- ④ 価格対象 (一般かSゲストかセレクト) -->
                        <div class="form-group">
                            <label>④ 価格対象 (セレクト)</label>
                            <select id="edit-price-tier">
                                <option value="unconfirmed" ${(!d.price_tier || d.price_tier === 'unconfirmed') ? 'selected' : ''}>⚠️ 未確認 (要確認)</option>
                                <option value="general" ${d.price_tier === 'general' ? 'selected' : ''}>一般</option>
                                <option value="s_guest" ${d.price_tier === 's_guest' ? 'selected' : ''}>⭐ Sゲスト</option>
                            </select>
                        </div>
                        
                        <!-- ⑤ アレルギー (セレクト) -->
                        <div class="form-group">
                            <label>⑤ アレルギー (セレクト)</label>
                            <select id="edit-allergy-status" onchange="document.getElementById('edit-allergy-detail-wrap').style.display = this.value === 'has' ? 'block' : 'none'">
                                <option value="unconfirmed" ${(!d.allergy_status || d.allergy_status === 'unconfirmed') ? 'selected' : ''}>⚠️ 未確認 (要確認)</option>
                                <option value="none" ${d.allergy_status === 'none' ? 'selected' : ''}>なし</option>
                                <option value="has" ${d.allergy_status === 'has' ? 'selected' : ''}>あり ⚠️</option>
                            </select>
                        </div>
                        <div class="form-group" id="edit-allergy-detail-wrap" style="display: ${d.allergy_status === 'has' ? 'block' : 'none'};">
                            <label style="color:var(--danger); font-weight:bold;">⚠️ アレルギー詳細内容</label>
                            <input type="text" id="edit-allergies" value="${d.allergies || ''}" placeholder="例: エビ・カニ、そば、卵">
                        </div>

                        <!-- ⑥ 予約経路 (LINE／Mail／店頭かセレクト) -->
                        <div class="form-row">
                            <div class="form-group">
                                <label>⑥ 予約経路 (セレクト)</label>
                                <select id="edit-source">
                                    <option value="line" ${d.source === 'line' ? 'selected' : ''}>LINE</option>
                                    <option value="email" ${d.source === 'email' ? 'selected' : ''}>Mail</option>
                                    <option value="front" ${d.source === 'front' ? 'selected' : ''}>店頭</option>
                                    <option value="phone" ${d.source === 'phone' ? 'selected' : ''}>電話</option>
                                    <option value="other" ${d.source === 'other' ? 'selected' : ''}>その他</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>ステータス</label>
                                <select id="edit-status">
                                    <option value="confirmed" ${d.status === 'confirmed' ? 'selected' : ''}>確定</option>
                                    <option value="tentative" ${d.status === 'tentative' ? 'selected' : ''}>仮予約</option>
                                    <option value="cancelled" ${d.status === 'cancelled' ? 'selected' : ''}>キャンセル</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>料金 (円)</label>
                                <input type="number" id="edit-price" value="${d.price || 0}">
                            </div>
                            <div class="form-group">
                                <label>連絡先</label>
                                <input type="text" id="edit-contact" value="${d.contact || ''}" placeholder="090-XXXX-XXXX">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>社内メモ / LINE受信メッセージ</label>
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
                        <!-- 要確認バナー -->
                        ${hasWarning ? `
                            <div class="unconfirmed-banner">
                                <span class="warn-icon">⚠️</span>
                                <div>
                                    <strong>以下の項目が未確認です：</strong>
                                    <div style="margin-top:0.2rem; color:#fca5a5;">${unconfirmed.join('、')}</div>
                                </div>
                            </div>
                        ` : `
                            <div class="confirmed-banner">
                                <span>✅</span> <strong>①〜⑤の全項目が確認済みです</strong>
                            </div>
                        `}

                        <!-- ① 宿泊者氏名の横に予約者氏名 -->
                        <div class="detail-item">
                            <div class="detail-label">① 氏名</div>
                            <div style="display:flex; flex-wrap:wrap; align-items:baseline; gap:1rem; margin-top:0.25rem;">
                                <div style="font-size:1.35rem; font-weight:700; color:#fff;">
                                    👤 ${d.guest_name} 様
                                </div>
                                <div style="font-size:1.05rem; color:var(--text-secondary);">
                                    🤝 予約者: ${d.booker_name ? `<strong>${d.booker_name} 様</strong>` : '<span class="warn-badge">⚠️ 要確認 (未入力)</span>'}
                                </div>
                            </div>
                        </div>

                        <!-- ② 宿泊カレンダー (宿泊日程) -->
                        <div class="detail-item">
                            <div class="detail-label">② 宿泊カレンダー (日程)</div>
                            <div class="detail-val" style="font-size:1.15rem; font-weight:600; color:#8ab4f8; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <span>📅 ${app.formatDateWithDay(d.check_in)} 〜 ${app.formatDateWithDay(d.check_out)}</span>
                                <span class="badge" style="background:rgba(66,133,244,0.2); color:#8ab4f8;">${nights}泊</span>
                            </div>
                        </div>

                        <!-- ③ 部屋番号、人数 -->
                        <div class="detail-item">
                            <div class="detail-label">③ 部屋番号 ＆ 宿泊人数</div>
                            <div style="display:flex; gap:1.5rem; align-items:center; margin-top:0.25rem;">
                                <div class="detail-val" style="font-size:1.2rem; font-weight:bold; color:#a5b4fc;">
                                    🚪 ${d.room_number ? `${d.room_number}号室` : '<span class="warn-badge">⚠️ 部屋番号要確認</span>'}
                                </div>
                                <div class="detail-val" style="font-size:1.1rem; color:#fff;">
                                    👥 ${d.num_guests ? `${d.num_guests}名` : '<span class="warn-badge">⚠️ 人数要確認</span>'}
                                </div>
                            </div>
                        </div>

                        <!-- ④ 価格対象 (一般かSゲストかセレクト) -->
                        <div class="detail-item">
                            <div class="detail-label">④ 価格対象</div>
                            <div style="margin-top:0.25rem;">
                                ${app.getBadgeHtml('price_tier', d.price_tier)}
                            </div>
                        </div>

                        <!-- ⑤ アレルギー -->
                        <div class="detail-item">
                            <div class="detail-label">⑤ アレルギー</div>
                            <div style="margin-top:0.25rem;">
                                ${d.allergy_status === 'has'
                                    ? `<div style="color:var(--danger); font-weight:bold; font-size:1.1rem;">🚨 あり: ${d.allergies || '詳細確認要⚠️'}</div>`
                                    : (d.allergy_status === 'none'
                                        ? `<div style="color:var(--success); font-weight:600;">✅ アレルギーなし</div>`
                                        : `<span class="badge badge-allergy allergy-unconfirmed" style="font-size:1rem; padding:0.4rem 0.8rem;">⚠️ アレルギー要確認</span>`)
                                }
                            </div>
                        </div>

                        <!-- ⑥ 予約経路 -->
                        <div class="detail-item">
                            <div class="detail-label">⑥ 予約経路 ＆ ステータス</div>
                            <div class="badges-wrap" style="margin-top:0.25rem;">
                                ${app.getBadgeHtml('source', d.source)}
                                ${app.getBadgeHtml('status', d.status)}
                            </div>
                        </div>

                        <!-- 料金・連絡先 -->
                        <div class="detail-item">
                            <div class="detail-label">料金 / 連絡先</div>
                            <div class="detail-val">¥${(d.price || 0).toLocaleString()} / ${d.contact || '連絡先未設定'}</div>
                        </div>

                        <!-- 社内メモ -->
                        <div class="detail-item">
                            <div class="detail-label">社内メモ / 受信メッセージ</div>
                            <div class="detail-val" style="white-space: pre-wrap; background:rgba(0,0,0,0.25); padding:0.75rem; border-radius:8px; margin-top:0.25rem; font-size:0.95rem;">${d.notes || '-'}</div>
                        </div>

                        <!-- Googleカレンダー追加ボタン -->
                        <div class="detail-item" style="padding-top:1rem;">
                            <button class="btn-primary" style="background:linear-gradient(135deg, #4285F4, #34A853); display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="reservations.openGoogleCalendar(${d.id})">
                                <span>📅 Googleカレンダーに個別登録</span>
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

        const allergyStatus = document.getElementById('edit-allergy-status')?.value || 'unconfirmed';
        const priceTier = document.getElementById('edit-price-tier')?.value || 'unconfirmed';

        const updateData = {
            guest_name: document.getElementById('edit-guest-name').value,
            booker_name: document.getElementById('edit-booker-name').value,
            room_number: document.getElementById('edit-room-number').value,
            check_in: document.getElementById('edit-check-in').value,
            check_out: document.getElementById('edit-check-out').value,
            num_guests: parseInt(document.getElementById('edit-num-guests').value, 10) || 1,
            price_tier: priceTier,
            allergy_status: allergyStatus,
            has_allergy: allergyStatus === 'has' ? 1 : 0,
            allergies: allergyStatus === 'has' ? (document.getElementById('edit-allergies')?.value || '') : '',
            price: parseInt(document.getElementById('edit-price').value, 10) || 0,
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

    async updateStatus(status) {
        if (!this.currentId) return;
        const res = await app.apiPut(`/api/reservations/${this.currentId}`, { status });
        if (res && res.success) {
            app.showToast(`ステータスを更新しました`, 'success');
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

