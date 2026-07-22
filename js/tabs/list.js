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
      const optionsHtml = statusOptions.map((s) =>
        `<div class="status-option ${s === item.상태 ? 'current' : ''}" data-value="${escapeHtml(s)}">${escapeHtml(s)}</div>`
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
              <button type="button" class="status-chip-trigger ${statusBadgeClass(item.상태)}">${escapeHtml(item.상태)}</button>
              <div class="status-dropdown" hidden>${optionsHtml}</div>
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

    function closeAllStatusDropdowns() {
      container.querySelectorAll('.status-dropdown').forEach((d) => { d.hidden = true; });
    }

    container.querySelectorAll('.status-chip-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = trigger.nextElementSibling;
        const wasHidden = dropdown.hidden;
        closeAllStatusDropdowns();
        dropdown.hidden = !wasHidden;
      });
    });

    container.querySelectorAll('.status-option').forEach((option) => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cell = option.closest('.status-cell');
        const id = option.closest('tr').dataset.id;
        const newStatus = option.dataset.value;
        const result = await callApi('updateStatus', { id: id, status: newStatus });
        cell.querySelector('.status-dropdown').hidden = true;
        if (!result.ok) {
          await showAlert('상태 변경 실패: ' + result.error);
          return;
        }
        const item = listResult.items.find((i) => i.id === id);
        if (item) item.상태 = newStatus;
        const trigger = cell.querySelector('.status-chip-trigger');
        trigger.className = 'status-chip-trigger ' + statusBadgeClass(newStatus);
        trigger.textContent = newStatus;
        cell.querySelectorAll('.status-option').forEach((o) => {
          o.classList.toggle('current', o.dataset.value === newStatus);
        });
      });
    });

    container.querySelectorAll('.delete-as-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
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

    container.querySelectorAll('.list-table tbody tr').forEach((row) => {
      row.addEventListener('click', () => openListDetailModal(row.dataset.id));
    });
  }

  function openListDetailModal(id) {
    const item = listResult.items.find((i) => i.id === id);
    if (!item) return;

    const bodyHtml = `
      <div class="detail-grid">
        ${detailRow('브랜드', escapeHtml(item.브랜드))}
        ${detailRow('품목', escapeHtml(item.품목))}
        ${detailRow('품번', escapeHtml(item.품번))}
        ${detailRow('생산연도', escapeHtml(item.생산연도))}
        ${detailRow('사이즈', escapeHtml(item.사이즈))}
        ${detailRow('색상', escapeHtml(item.색상))}
        ${detailRow('고객분류', escapeHtml(item.고객분류))}
        ${detailRow('회원카드', escapeHtml(item.회원카드))}
        ${detailRow('회원연락처', escapeHtml(item.회원연락처))}
        ${detailRow('바코드번호', escapeHtml(item.바코드번호))}
        ${detailRow('매장위치', escapeHtml(item.매장위치))}
        ${detailRow('수거요청일자', escapeHtml(item.수거요청일자))}
        ${detailRow('브랜드AS동의일', escapeHtml(item.브랜드AS동의일))}
        ${detailRow('접수자', escapeHtml(item.접수자))}
        ${detailRow('접수일시', escapeHtml(item.접수일시))}
        ${detailRow('현재상태', statusBadge(item.상태))}
      </div>
      ${detailRow('손상부위', escapeHtml(item.손상부위))}
      ${detailRow('요청건관련메모', escapeHtml(item.요청건관련메모))}
      ${item.현장메모 ? detailRow('현장메모', escapeHtml(item.현장메모)) : ''}
    `;

    openDetailModal(`${item.브랜드} 접수 상세`, bodyHtml);
  }

  draw();

  document.addEventListener('click', () => {
    container.querySelectorAll('.status-dropdown').forEach((d) => { d.hidden = true; });
  });
}
