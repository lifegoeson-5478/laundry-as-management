const SETTINGS_SECTIONS = ['직원 관리', '상태값 관리'];

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
    else drawStatusPanel(panel);
  }

  function drawStaffPanel(panel) {
    panel.innerHTML = `
      <div id="staff-list">${loadingScreen('직원 목록을 불러오고 있어요')}</div>
      <form id="add-staff-form" class="settings-form">
        <input type="email" name="이메일" placeholder="이메일" required>
        <input type="text" name="이름" placeholder="이름" required>
        <select name="역할"><option value="일반">일반</option><option value="관리자">관리자</option></select>
        <button type="submit" class="btn-primary-block">추가</button>
      </form>
    `;

    async function loadStaff() {
      const result = await callApi('listStaff', {});
      const list = document.getElementById('staff-list');
      if (!list) return;
      if (!result.ok) { list.textContent = result.error; return; }
      list.innerHTML = result.items.map((staff) => `
        <div class="card settings-row" data-email="${escapeHtml(staff.이메일)}">
          <div>
            <strong>${escapeHtml(staff.이름)}</strong>
            <div class="field-row-sub">${escapeHtml(staff.이메일)} · ${escapeHtml(staff.역할)}</div>
          </div>
          <div class="settings-row-actions">
            <label><input type="checkbox" class="staff-active" ${String(staff.활성여부) === 'true' ? 'checked' : ''}> 활성</label>
            <button type="button" class="delete-staff-btn btn-outline-small">삭제</button>
          </div>
        </div>
      `).join('') || '<div class="field-empty">등록된 직원이 없습니다.</div>';

      list.querySelectorAll('.staff-active').forEach((checkbox) => {
        checkbox.addEventListener('change', async (e) => {
          const email = e.target.closest('.card').dataset.email;
          await callApi('updateStaff', { email: email, updates: { 활성여부: e.target.checked } });
        });
      });

      list.querySelectorAll('.delete-staff-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const email = btn.closest('.card').dataset.email;
          if (!(await showConfirm(email + ' 직원을 삭제할까요?'))) return;
          const result = await callApi('deleteStaff', { email: email });
          if (result.ok) loadStaff();
          else await showAlert('삭제 실패: ' + result.error);
        });
      });
    }

    panel.querySelector('#add-staff-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const form = Object.fromEntries(formData.entries());
      const result = await callApi('addStaff', { form: form });
      if (result.ok) { e.target.reset(); loadStaff(); }
      else await showAlert('추가 실패: ' + result.error);
    });

    loadStaff();
  }

  function drawStatusPanel(panel) {
    panel.innerHTML = `
      <div id="status-list">${loadingScreen('상태값 목록을 불러오고 있어요')}</div>
      <form id="add-status-form" class="settings-form">
        <input type="text" name="name" placeholder="새 상태값" required>
        <input type="color" name="color" value="#00a991" title="색상">
        <button type="submit" class="btn-primary-block">추가</button>
      </form>
    `;

    async function loadStatus() {
      const result = await callApi('listStatus', {});
      const list = document.getElementById('status-list');
      if (!list) return;
      if (!result.ok) { list.textContent = result.error; return; }
      invalidateStatusCache();
      await getStatusOptions();
      list.innerHTML = result.items.map((item) => `
        <div class="card settings-row" data-name="${escapeHtml(item.name)}">
          ${statusBadge(item.name)}
          <div class="settings-row-actions">
            <input type="color" class="status-color-input" value="${item.color || '#9aa0ad'}" title="색상 선택">
            <button type="button" class="delete-status-btn btn-outline-small">삭제</button>
          </div>
        </div>
      `).join('') || '<div class="field-empty">등록된 상태값이 없습니다.</div>';

      list.querySelectorAll('.status-color-input').forEach((input) => {
        input.addEventListener('change', async (e) => {
          const name = e.target.closest('.card').dataset.name;
          const result = await callApi('updateStatusColor', { name: name, color: e.target.value });
          if (result.ok) { invalidateStatusCache(); loadStatus(); }
          else await showAlert('색상 변경 실패: ' + result.error);
        });
      });

      list.querySelectorAll('.delete-status-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const name = btn.closest('.card').dataset.name;
          if (!(await showConfirm(name + ' 상태값을 삭제할까요?'))) return;
          const result = await callApi('deleteStatus', { name: name });
          if (result.ok) { invalidateStatusCache(); loadStatus(); }
          else await showAlert('삭제 실패: ' + result.error);
        });
      });
    }

    panel.querySelector('#add-status-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const name = formData.get('name');
      const color = formData.get('color');
      const result = await callApi('addStatus', { name: name, color: color });
      if (result.ok) { e.target.reset(); invalidateStatusCache(); loadStatus(); }
      else await showAlert('추가 실패: ' + result.error);
    });

    loadStatus();
  }

  drawShell();
}
