const LIST_FILTERS = {
  '전체': null,
  '접수 필요': (r) => r.상태 === '접수 필요',
  '회수 필요': (r) => r.상태 === '회수 필요',
  '중동사 진행': (r) => r.매장위치 === '중동사',
  '아토즈레더 진행': (r) => r.매장위치 === '아토즈레더',
  '택배 접수': (r) => String(r.매장위치 || '').indexOf('택배') !== -1
};

const LIST_EDIT_FIELDS = [
  ['고객분류', 'text'], ['회원카드', 'text'], ['회원연락처', 'text'],
  ['수거요청일자', 'date'], ['바코드번호', 'text'],
  ['브랜드', 'text'], ['품목', 'text'], ['품번', 'text'], ['생산연도', 'text'],
  ['사이즈', 'text'], ['색상', 'text'], ['매장위치', 'text'],
  ['브랜드AS동의일', 'date'], ['손상부위', 'text'], ['요청건관련메모', 'text']
];

function ensureStatusPortal_() {
  let portal = document.getElementById('status-dropdown-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'status-dropdown-portal';
    portal.className = 'status-dropdown';
    portal.hidden = true;
    document.body.appendChild(portal);
  }
  return portal;
}

function closeStatusPortal_() {
  const portal = document.getElementById('status-dropdown-portal');
  if (portal) portal.hidden = true;
}

async function renderListTab(container, params) {
  container.innerHTML = '<div>불러오는 중...</div>';

  const listResult = await callApi('listAS', {});
  const statusResult = await callApi('listStatus', {});

  if (!listResult.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(listResult.error)}</div>`;
    return;
  }

  const statusOptions = statusResult.ok ? statusResult.items : [];
  let currentFilter = '전체';
  let searchText = '';

  let specialFilter = null;
  let specialLabel = '';
  if (params && params.agingBucket) {
    specialLabel = `경과기간: ${params.agingBucket}`;
    specialFilter = (r) =>
      r.상태 !== '출고 완료' && r.상태 !== '보상 종결' &&
      computeAgingBucketClient(r.수거요청일자) === params.agingBucket;
  } else if (params && params.staff) {
    specialLabel = `담당자: ${params.staff}`;
    specialFilter = (r) =>
      r.상태 !== '출고 완료' && r.상태 !== '보상 종결' && r.접수자 === params.staff;
  }

  function draw() {
    const filterFn = LIST_FILTERS[currentFilter];
    let items = filterFn ? listResult.items.filter(filterFn) : listResult.items;
    if (specialFilter) items = items.filter(specialFilter);
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter((r) =>
        String(r.회원카드 || '').toLowerCase().includes(q) ||
        String(r.회원연락처 || '').toLowerCase().includes(q) ||
        String(r.바코드번호 || '').toLowerCase().includes(q)
      );
    }

    const filterButtons = Object.keys(LIST_FILTERS).map((name) =>
      `<button data-filter="${escapeHtml(name)}" class="list-tab ${name === currentFilter ? 'active' : ''}">${escapeHtml(name)}</button>`
    ).join('');

    const specialBanner = specialFilter ? `
      <div class="special-filter-banner">
        ${escapeHtml(specialLabel)}
        <button type="button" id="clear-special-filter">필터 해제</button>
      </div>
    ` : '';

    const rows = items.map((item) => `
      <tr data-id="${escapeHtml(item.id)}">
        <td>${escapeHtml(item.고객분류)}</td>
        <td>${escapeHtml(item.회원연락처)}</td>
        <td>${escapeHtml(item.회원카드)}</td>
        <td>${escapeHtml(item.바코드번호)}</td>
        <td>${escapeHtml(item.품목)}</td>
        <td>${escapeHtml(formatDateOnly(item.접수일시))}</td>
        <td>${escapeHtml(item.접수자)}</td>
        <td>
          <button type="button" class="status-chip-trigger ${statusBadgeClass(item.상태)}" data-id="${escapeHtml(item.id)}">${escapeHtml(item.상태)}</button>
        </td>
        <td><button class="delete-as-btn">삭제</button></td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div id="list-tab-bar">${filterButtons}</div>
      ${specialBanner}
      <input type="search" id="list-search" placeholder="회원카드, 회원연락처, 바코드로 검색" value="${escapeHtml(searchText)}">
      <table class="list-table">
        <thead>
          <tr>
            <th>고객분류</th><th>휴대폰번호</th><th>회원카드</th><th>바코드번호</th><th>품목</th><th>접수일</th><th>접수자</th><th>상태</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="9">표시할 항목이 없습니다.</td></tr>`}
        </tbody>
      </table>
    `;

    const searchInput = document.getElementById('list-search');
    searchInput.focus();
    searchInput.setSelectionRange(searchText.length, searchText.length);
    searchInput.addEventListener('input', (e) => {
      searchText = e.target.value;
      draw();
    });

    const clearBtn = document.getElementById('clear-special-filter');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        specialFilter = null;
        specialLabel = '';
        draw();
      });
    }

    container.querySelectorAll('#list-tab-bar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        draw();
      });
    });

    container.querySelectorAll('.status-chip-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatusPortal(trigger);
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

  function openStatusPortal(trigger) {
    const id = trigger.dataset.id;
    const item = listResult.items.find((i) => i.id === id);
    if (!item) return;

    const portal = ensureStatusPortal_();
    const alreadyOpenForThis = !portal.hidden && portal.dataset.forId === id;
    if (alreadyOpenForThis) {
      portal.hidden = true;
      return;
    }

    portal.dataset.forId = id;
    portal.innerHTML = statusOptions.map((s) =>
      `<div class="status-option ${s === item.상태 ? 'current' : ''}" data-value="${escapeHtml(s)}">${escapeHtml(s)}</div>`
    ).join('');

    const rect = trigger.getBoundingClientRect();
    portal.style.top = `${rect.bottom + 6}px`;
    portal.style.left = `${rect.left}px`;
    portal.hidden = false;

    portal.querySelectorAll('.status-option').forEach((option) => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newStatus = option.dataset.value;
        const result = await callApi('updateStatus', { id: id, status: newStatus });
        portal.hidden = true;
        if (!result.ok) {
          await showAlert('상태 변경 실패: ' + result.error);
          return;
        }
        item.상태 = newStatus;
        const rowTrigger = container.querySelector(`.status-chip-trigger[data-id="${id}"]`);
        if (rowTrigger) {
          rowTrigger.className = 'status-chip-trigger ' + statusBadgeClass(newStatus);
          rowTrigger.textContent = newStatus;
        }
      });
    });
  }

  function renderDetailBody(item) {
    return `
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
        ${detailRow('수거요청일자', escapeHtml(formatDateOnly(item.수거요청일자)))}
        ${detailRow('브랜드AS동의일', escapeHtml(formatDateOnly(item.브랜드AS동의일)))}
        ${detailRow('접수자', escapeHtml(item.접수자))}
        ${detailRow('접수일시', escapeHtml(formatDateOnly(item.접수일시)))}
        ${detailRow('현재상태', statusBadge(item.상태))}
      </div>
      ${detailRow('손상부위', escapeHtml(item.손상부위))}
      ${detailRow('요청건관련메모', escapeHtml(item.요청건관련메모))}
      ${detailRow('현장메모', escapeHtml(item.현장메모 || '(없음)'))}
      <button type="button" class="btn-outline-block" id="list-edit-btn">수정</button>
    `;
  }

  function renderEditBody(item) {
    const fieldsHtml = LIST_EDIT_FIELDS.map(([name, type]) => `
      <label>${name}<input type="${type}" name="${name}" value="${escapeHtml(item[name] || '')}"></label>
    `).join('');
    return `
      <form id="list-edit-form">
        <div class="detail-grid">${fieldsHtml}</div>
        <div class="wizard-actions" style="margin-top: 16px;">
          <button type="submit" class="btn-primary-block">저장</button>
          <button type="button" class="btn-outline-block" id="list-edit-cancel">취소</button>
        </div>
      </form>
    `;
  }

  function openListDetailModal(id) {
    const item = listResult.items.find((i) => i.id === id);
    if (!item) return;

    const modal = openDetailModal(`${item.바코드번호} 접수 상세`, renderDetailBody(item));

    function showView() {
      modal.querySelector('.modal-body').innerHTML = renderDetailBody(item);
      modal.querySelector('#list-edit-btn').addEventListener('click', showEdit);
    }

    function showEdit() {
      modal.querySelector('.modal-body').innerHTML = renderEditBody(item);
      modal.querySelector('#list-edit-cancel').addEventListener('click', showView);
      modal.querySelector('#list-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const form = {};
        formData.forEach((value, key) => { form[key] = value; });

        const result = await callApi('updateAS', { id: item.id, form: form });
        if (!result.ok) {
          await showAlert('수정 실패: ' + result.error);
          return;
        }
        Object.assign(item, form);
        await showAlert('수정되었습니다.');
        closeAppModal();
        draw();
      });
    }

    modal.querySelector('#list-edit-btn').addEventListener('click', showEdit);
  }

  draw();

  document.addEventListener('click', (e) => {
    const portal = document.getElementById('status-dropdown-portal');
    if (portal && !portal.hidden && !portal.contains(e.target) && !e.target.classList.contains('status-chip-trigger')) {
      portal.hidden = true;
    }
  });
}
