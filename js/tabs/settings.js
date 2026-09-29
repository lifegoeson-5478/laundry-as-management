const SETTINGS_SECTIONS = ['직원 관리', '상태값 관리', '데이터 정리'];

async function renderSettingsTab(container) {
  let currentSection = SETTINGS_SECTIONS[0];

  function drawShell() {
    const tabButtons = SETTINGS_SECTIONS.map((title) =>
      `<button class="list-tab ${title === currentSection ? 'active' : ''}" data-section="${escapeHtml(title)}">${escapeHtml(title)}</button>`
    ).join('');

    container.innerHTML = `
      <div id="list-tab-bar">${tabButtons}</div>
      <div id="settings-panel"></div>
    `;

    container.querySelectorAll('#list-tab-bar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSection = btn.dataset.section;
        drawShell();
      });
    });

    const panel = document.getElementById('settings-panel');
    if (currentSection === '직원 관리') drawStaffPanel(panel);
    else if (currentSection === '상태값 관리') drawStatusPanel(panel);
    else drawCleanupPanel(panel);
  }

  async function drawCleanupPanel(panel) {
    panel.innerHTML = loadingScreen('오래된 접수 건을 세고 있어요');
    const preview = await callApi('deleteOldAS', { dryRun: true });
    if (!document.body.contains(panel)) return;
    if (!preview.ok) { panel.textContent = preview.error; return; }
    const cutoffDate = new Date(preview.cutoff).toLocaleDateString('sv-SE');
    panel.innerHTML = `
      <div class="cleanup-panel">
        <div class="cleanup-desc">
          오늘 기준 6개월 전(<b>${escapeHtml(cutoffDate)}</b>)보다 먼저 접수된 건을 삭제합니다.<br>
          삭제한 건은 되돌릴 수 없어요.
        </div>
        <div class="cleanup-count"><span class="mono">대상</span><b>${preview.count}</b>건</div>
        <button type="button" class="btn-danger" id="delete-old-btn" ${preview.count ? '' : 'disabled'}>6개월 지난 접수 건 삭제</button>
      </div>
    `;
    panel.querySelector('#delete-old-btn').addEventListener('click', async () => {
      if (!(await showConfirm(`${cutoffDate} 이전에 접수된 ${preview.count}건을 삭제할까요?\n삭제 후에는 되돌릴 수 없습니다.`))) return;
      const result = await callApi('deleteOldAS', {});
      if (!result.ok) { await showAlert('삭제 실패: ' + result.error); return; }
      sessionStorage.removeItem('tabHtml_list');
      sessionStorage.removeItem('tabHtml_field');
      sessionStorage.removeItem('tabHtml_dashboard');
      await showAlert(`${result.count}건을 삭제했습니다.`);
      drawCleanupPanel(panel);
    });
  }

  function drawStaffPanel(panel) {
    panel.innerHTML = `
      <section class="admin-panel">
        <h3 class="admin-panel-title">새 계정 추가</h3>
        <form id="add-staff-form" class="admin-form">
          <input type="email" name="이메일" placeholder="이메일" required>
          <input type="text" name="이름" placeholder="이름" required>
          <label class="admin-check"><input type="checkbox" name="역할" value="관리자"> 관리자로 등록</label>
          <button type="submit" class="btn-add">+ 추가</button>
        </form>
        <p class="admin-hint">추가한 이메일의 구글 계정으로 바로 로그인할 수 있어요.</p>
      </section>
      <section class="admin-panel">
        <h3 class="admin-panel-title">계정 목록</h3>
        <div id="staff-list">${loadingScreen('직원 목록을 불러오고 있어요')}</div>
      </section>
    `;
    const myEmail = (getSession() || {}).email;
    let staffItems = [];
    let showInactive = false; // 비활성 계정 묶음은 처음엔 접힘
    const isActiveStaff = (staff) => String(staff.활성여부) === 'true';

    async function loadStaff() {
      const result = await callApi('listStaff', {});
      const list = document.getElementById('staff-list');
      if (!list) return;
      if (!result.ok) { list.textContent = result.error; return; }
      staffItems = result.items;
      renderStaff();
    }

    // 활성 계정 먼저, 비활성 계정은 아래 접히는 묶음으로
    function renderStaff() {
      const list = document.getElementById('staff-list');
      const active = staffItems.filter(isActiveStaff);
      const inactive = staffItems.filter((s) => !isActiveStaff(s));
      const inactiveGroup = inactive.length ? `
        <div class="month-row list-month admin-group" id="inactive-toggle">${showInactive ? '▼' : '▶'} 비활성 계정 <span>(${inactive.length}명)</span></div>
        ${showInactive ? inactive.map(renderStaffRow).join('') : ''}` : '';
      list.innerHTML = (active.map(renderStaffRow).join('') + inactiveGroup) ||
        '<div class="field-empty">등록된 직원이 없습니다.</div>';
    }

    function renderStaffRow(staff) {
        const isAdmin = staff.역할 === '관리자';
        const isActive = isActiveStaff(staff);
        const actions = staff.이메일 === myEmail
          ? '<span class="me-tag">나</span>'
          : `<button type="button" class="btn-sm-outline" data-act="role">${isAdmin ? '관리자 해제' : '관리자로 지정'}</button>
             <button type="button" class="btn-sm-outline" data-act="active">${isActive ? '비활성화' : '활성화'}</button>
             <button type="button" class="btn-text-danger" data-act="delete">삭제</button>`;
        return `
          <div class="admin-row ${isActive ? '' : 'inactive'}" data-email="${escapeHtml(staff.이메일)}">
            <strong class="admin-row-main">${escapeHtml(staff.이메일)}</strong>
            <span class="admin-row-meta">${escapeHtml(staff.이름)}</span>
            ${isActive ? '' : '<span class="admin-row-meta">비활성</span>'}
            ${isAdmin ? '<span class="role-dot">관리자</span>' : ''}
            ${actions}
          </div>`;
    }

    panel.querySelector('#staff-list').addEventListener('click', async (e) => {
      if (e.target.closest('#inactive-toggle')) {
        showInactive = !showInactive;
        renderStaff();
        return;
      }
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const email = btn.closest('.admin-row').dataset.email;
      const staff = staffItems.find((s) => s.이메일 === email);
      let result;
      if (btn.dataset.act === 'role') {
        const next = staff.역할 === '관리자' ? '일반' : '관리자';
        result = await callApi('updateStaff', { email: email, updates: { 역할: next } });
      } else if (btn.dataset.act === 'active') {
        result = await callApi('updateStaff', { email: email, updates: { 활성여부: String(staff.활성여부) !== 'true' } });
      } else {
        if (!(await showConfirm(email + ' 계정을 삭제할까요?'))) return;
        result = await callApi('deleteStaff', { email: email });
      }
      if (result.ok) loadStaff();
      else await showAlert('변경 실패: ' + result.error);
    });

    panel.querySelector('#add-staff-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = Object.fromEntries(new FormData(e.target).entries());
      form.역할 = form.역할 || '일반';
      const result = await callApi('addStaff', { form: form });
      if (result.ok) { e.target.reset(); loadStaff(); }
      else await showAlert('추가 실패: ' + result.error);
    });

    loadStaff();
  }

  function drawStatusPanel(panel) {
    panel.innerHTML = `
      <section class="admin-panel">
        <h3 class="admin-panel-title">새 상태값 추가</h3>
        <form id="add-status-form" class="admin-form">
          <input type="text" name="name" placeholder="상태값 이름" required>
          <label class="swatch-label">배경<input type="color" class="swatch" name="color" value="#CDF3E9"></label>
          <label class="swatch-label">글자<input type="color" class="swatch" name="textColor" value="#08926C"></label>
          <span class="badge status-preview" id="new-status-preview">미리보기</span>
          <button type="submit" class="btn-add">+ 추가</button>
        </form>
        <p class="admin-hint">목록·현장·대시보드에서 이 색으로 표시돼요.</p>
      </section>
      <section class="admin-panel">
        <h3 class="admin-panel-title">상태값 목록</h3>
        <div id="status-list">${loadingScreen('상태값 목록을 불러오고 있어요')}</div>
      </section>
    `;

    const addForm = panel.querySelector('#add-status-form');
    const newPreview = panel.querySelector('#new-status-preview');
    function syncNewPreview() {
      newPreview.textContent = addForm.elements.name.value || '미리보기';
      newPreview.style.background = addForm.elements.color.value;
      newPreview.style.color = addForm.elements.textColor.value;
    }
    addForm.addEventListener('input', syncNewPreview);
    addForm.addEventListener('reset', () => setTimeout(syncNewPreview, 0));
    syncNewPreview();

    async function loadStatus() {
      const result = await callApi('listStatus', {});
      const list = document.getElementById('status-list');
      if (!list) return;
      if (!result.ok) { list.textContent = result.error; return; }
      invalidateStatusCache();
      await getStatusOptions();
      list.innerHTML = result.items.map((item) => {
        const color = item.color || '#EAECEF';
        const textColor = item.textColor || textColorForBg(color);
        return `
          <div class="admin-row" data-name="${escapeHtml(item.name)}">
            <span class="admin-row-main"><span class="badge status-preview" style="background:${color};color:${textColor}">${escapeHtml(item.name)}</span></span>
            <span class="admin-row-meta mono status-hex">${color.toUpperCase()} · ${textColor.toUpperCase()}</span>
            <label class="swatch-label">배경<input type="color" class="swatch" data-kind="color" value="${color}"></label>
            <label class="swatch-label">글자<input type="color" class="swatch" data-kind="text" value="${textColor}"></label>
            <button type="button" class="btn-text-danger" data-act="delete">삭제</button>
          </div>`;
      }).join('') || '<div class="field-empty">등록된 상태값이 없습니다.</div>';
    }

    const list = panel.querySelector('#status-list');
    function rowColors(row) {
      return {
        color: row.querySelector('[data-kind="color"]').value,
        textColor: row.querySelector('[data-kind="text"]').value
      };
    }
    // 색을 고르는 동안 미리보기만 바꾸고, 고르기를 마치면(change) 저장
    list.addEventListener('input', (e) => {
      const row = e.target.closest('.admin-row');
      if (!row) return;
      const { color, textColor } = rowColors(row);
      const chip = row.querySelector('.status-preview');
      chip.style.background = color;
      chip.style.color = textColor;
      row.querySelector('.status-hex').textContent = `${color.toUpperCase()} · ${textColor.toUpperCase()}`;
    });
    list.addEventListener('change', async (e) => {
      const row = e.target.closest('.admin-row');
      if (!row) return;
      const result = await callApi('updateStatusColor', Object.assign({ name: row.dataset.name }, rowColors(row)));
      if (result.ok) invalidateStatusCache();
      else await showAlert('색상 변경 실패: ' + result.error);
    });
    list.addEventListener('click', async (e) => {
      if (!e.target.closest('button[data-act="delete"]')) return;
      const name = e.target.closest('.admin-row').dataset.name;
      if (!(await showConfirm(name + ' 상태값을 삭제할까요?'))) return;
      const result = await callApi('deleteStatus', { name: name });
      if (result.ok) { invalidateStatusCache(); loadStatus(); }
      else await showAlert('삭제 실패: ' + result.error);
    });

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const result = await callApi('addStatus', {
        name: addForm.elements.name.value, color: addForm.elements.color.value, textColor: addForm.elements.textColor.value
      });
      if (result.ok) { addForm.reset(); invalidateStatusCache(); loadStatus(); }
      else await showAlert('추가 실패: ' + result.error);
    });

    loadStatus();
  }

  drawShell();
}
