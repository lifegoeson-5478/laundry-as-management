async function renderSettingsTab(container) {
  container.innerHTML = `
    <h2>직원 관리</h2>
    <div id="staff-list">불러오는 중...</div>
    <form id="add-staff-form">
      <input type="email" name="이메일" placeholder="이메일" required>
      <input type="text" name="이름" placeholder="이름" required>
      <select name="역할"><option value="일반">일반</option><option value="관리자">관리자</option></select>
      <button type="submit">추가</button>
    </form>

    <h2>상태값 관리</h2>
    <div id="status-list">불러오는 중...</div>
    <form id="add-status-form">
      <input type="text" name="name" placeholder="새 상태값" required>
      <button type="submit">추가</button>
    </form>
  `;

  async function loadStaff() {
    const result = await callApi('listStaff', {});
    const list = document.getElementById('staff-list');
    if (!result.ok) { list.textContent = result.error; return; }
    list.innerHTML = result.items.map((staff) => `
      <div class="card" data-email="${escapeHtml(staff.이메일)}">
        ${escapeHtml(staff.이름)} (${escapeHtml(staff.이메일)}) - ${escapeHtml(staff.역할)}
        <label><input type="checkbox" class="staff-active" ${String(staff.활성여부) === 'true' ? 'checked' : ''}> 활성</label>
        <button class="delete-staff-btn">삭제</button>
      </div>
    `).join('');

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

  async function loadStatus() {
    const result = await callApi('listStatus', {});
    const list = document.getElementById('status-list');
    if (!result.ok) { list.textContent = result.error; return; }
    list.innerHTML = result.items.map((name) => `
      <div class="card" data-name="${escapeHtml(name)}">
        ${escapeHtml(name)} <button class="delete-status-btn">삭제</button>
      </div>
    `).join('');

    list.querySelectorAll('.delete-status-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.closest('.card').dataset.name;
        const result = await callApi('deleteStatus', { name: name });
        if (result.ok) loadStatus();
        else await showAlert('삭제 실패: ' + result.error);
      });
    });
  }

  document.getElementById('add-staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const form = Object.fromEntries(formData.entries());
    const result = await callApi('addStaff', { form: form });
    if (result.ok) { e.target.reset(); loadStaff(); }
    else await showAlert('추가 실패: ' + result.error);
  });

  document.getElementById('add-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    const result = await callApi('addStatus', { name: name });
    if (result.ok) { e.target.reset(); loadStatus(); }
    else await showAlert('추가 실패: ' + result.error);
  });

  loadStaff();
  loadStatus();
}
