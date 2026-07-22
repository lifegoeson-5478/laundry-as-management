const LIST_FILTERS = {
  '전체': null,
  '접수 필요': (r) => r.상태 === '접수 필요',
  '회수 필요': (r) => r.상태 === '회수 필요',
  '중동사 진행': (r) => r.매장위치 === '중동사',
  '아토즈레더 진행': (r) => r.매장위치 === '아토즈레더',
  '택배 접수': (r) => String(r.매장위치 || '').indexOf('택배') !== -1
};

async function renderListTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';

  const listResult = await callApi('listAS', {});
  const statusResult = await callApi('listStatus', {});

  if (!listResult.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(listResult.error)}</div>`;
    return;
  }

  const statusOptions = statusResult.ok ? statusResult.items : [];
  let currentFilter = '전체';

  function draw() {
    const filterFn = LIST_FILTERS[currentFilter];
    const items = filterFn ? listResult.items.filter(filterFn) : listResult.items;

    const filterButtons = Object.keys(LIST_FILTERS).map((name) =>
      `<button data-filter="${escapeHtml(name)}" class="list-tab ${name === currentFilter ? 'active' : ''}">${escapeHtml(name)}</button>`
    ).join('');

    const rows = items.map((item) => {
      const statusOptionsHtml = statusOptions.map((s) =>
        `<option value="${escapeHtml(s)}" ${s === item.상태 ? 'selected' : ''}>${escapeHtml(s)}</option>`
      ).join('');
      return `
        <tr data-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.브랜드)}</td>
          <td>${escapeHtml(item.품목)}</td>
          <td>${escapeHtml(item.고객분류)}</td>
          <td>${escapeHtml(item.접수일시)}</td>
          <td>${escapeHtml(item.접수자)}</td>
          <td>
            <div class="status-cell">
              ${statusBadge(item.상태)}
              <select class="status-select">${statusOptionsHtml}</select>
            </div>
          </td>
          <td><button class="delete-as-btn">삭제</button></td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div id="list-tab-bar">${filterButtons}</div>
      <table class="list-table">
        <thead>
          <tr>
            <th>브랜드</th><th>품목</th><th>고객분류</th><th>접수일</th><th>접수자</th><th>상태</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7">표시할 항목이 없습니다.</td></tr>`}
        </tbody>
      </table>
    `;

    container.querySelectorAll('#list-tab-bar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        draw();
      });
    });

    container.querySelectorAll('.status-select').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = e.target.closest('tr').dataset.id;
        const newStatus = e.target.value;
        const result = await callApi('updateStatus', { id: id, status: newStatus });
        if (!result.ok) {
          await showAlert('상태 변경 실패: ' + result.error);
          return;
        }
        const item = listResult.items.find((i) => i.id === id);
        if (item) item.상태 = newStatus;
        const badge = e.target.closest('.status-cell').querySelector('.badge');
        badge.className = 'badge ' + statusBadgeClass(newStatus);
        badge.textContent = newStatus;
      });
    });

    container.querySelectorAll('.delete-as-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const id = row.dataset.id;
        if (!(await showConfirm('이 접수 건을 삭제할까요?'))) return;
        const result = await callApi('deleteAS', { id: id });
        if (result.ok) {
          listResult.items = listResult.items.filter((item) => item.id !== id);
          draw();
        } else {
          await showAlert('삭제 실패: ' + result.error);
        }
      });
    });
  }

  draw();
}
