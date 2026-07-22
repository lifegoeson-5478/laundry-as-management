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

  const [listResult, statusResult] = await Promise.all([
    callApi('listAS', {}),
    callApi('listStatus', {})
  ]);

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
      `<button data-filter="${escapeHtml(name)}" class="${name === currentFilter ? 'active' : ''}">${escapeHtml(name)}</button>`
    ).join('');

    const rows = items.map((item) => {
      const statusOptionsHtml = statusOptions.map((s) =>
        `<option value="${escapeHtml(s)}" ${s === item.상태 ? 'selected' : ''}>${escapeHtml(s)}</option>`
      ).join('');
      return `
        <div class="card" data-id="${escapeHtml(item.id)}">
          <strong>${escapeHtml(item.브랜드)}</strong> / ${escapeHtml(item.품목)} / ${escapeHtml(item.고객분류)}
          <div>접수일: ${escapeHtml(item.접수일시)} · 접수자: ${escapeHtml(item.접수자)}</div>
          <select class="status-select">${statusOptionsHtml}</select>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div id="list-filters">${filterButtons}</div>
      <div id="list-items">${rows || '<div>표시할 항목이 없습니다.</div>'}</div>
    `;

    container.querySelectorAll('#list-filters button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        draw();
      });
    });

    container.querySelectorAll('.status-select').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = e.target.closest('.card').dataset.id;
        const result = await callApi('updateStatus', { id: id, status: e.target.value });
        if (!result.ok) alert('상태 변경 실패: ' + result.error);
      });
    });
  }

  draw();
}
