const LIST_FILTERS = {
  '전체': null,
  '접수 필요': (r) => r.상태 === '접수 필요',
  '회수 필요': (r) => r.상태 === '회수 필요',
  '중동사 진행': (r) => r.매장위치 === '중동사',
  '아토즈레더 진행': (r) => r.매장위치 === '아토즈레더',
  '택배 접수': (r) => String(r.매장위치 || '').indexOf('택배') !== -1
};

const LIST_COLUMNS = [
  { label: '순번', sortable: false },
  { label: '고객분류', field: '고객분류', sortable: true },
  { label: '휴대폰번호', field: '회원연락처', sortable: true },
  { label: '회원카드', field: '회원카드', sortable: true },
  { label: '바코드번호', field: '바코드번호', sortable: true },
  { label: '브랜드', field: '브랜드', sortable: true },
  { label: '품목', field: '품목', sortable: true },
  { label: '접수일', field: '접수일시', sortable: true },
  { label: '접수자', field: '접수자', sortable: true },
  { label: '상태', field: '상태', sortable: true },
  { label: '', sortable: false }
];

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
  const cachedHtml = sessionStorage.getItem('tabHtml_list');
  container.innerHTML = cachedHtml || loadingScreen('접수 목록을 불러오고 있어요');

  const [listResult, statusOptions] = await Promise.all([
    callApi('listAS', {}),
    getStatusOptions()
  ]);

  if (activeTab !== 'list') return;
  if (!listResult.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(listResult.error)}</div>`;
    return;
  }
  let currentFilter = '전체';
  let searchText = '';
  let sortField = null;
  let sortDirection = 'asc';
  let selectedIds = new Set();

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

    if (sortField) {
      items = items.slice().sort((a, b) => {
        const av = String(a[sortField] || '');
        const bv = String(b[sortField] || '');
        const cmp = av.localeCompare(bv, 'ko');
        return sortDirection === 'asc' ? cmp : -cmp;
      });
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

    const rows = items.map((item, index) => `
      <tr data-id="${escapeHtml(item.id)}">
        <td data-label=""><input type="checkbox" class="row-select-checkbox" data-id="${escapeHtml(item.id)}" ${selectedIds.has(item.id) ? 'checked' : ''}></td>
        <td data-label="순번">${index + 1}</td>
        <td data-label="고객분류">${escapeHtml(item.고객분류)}</td>
        <td data-label="휴대폰번호">${escapeHtml(item.회원연락처)}</td>
        <td data-label="회원카드">${escapeHtml(item.회원카드)}</td>
        <td data-label="바코드번호">${escapeHtml(item.바코드번호)}</td>
        <td data-label="브랜드">${escapeHtml(item.브랜드)}</td>
        <td data-label="품목">${escapeHtml(item.품목)}</td>
        <td data-label="접수일">${escapeHtml(formatDateOnly(item.접수일시))}</td>
        <td data-label="접수자">${escapeHtml(item.접수자)}</td>
        <td data-label="상태">
          <button type="button" class="status-chip-trigger ${statusChipClass(item.상태)}" style="${statusChipStyle(item.상태)}" data-id="${escapeHtml(item.id)}">${escapeHtml(item.상태)}</button>
        </td>
        <td data-label=""><button class="delete-as-btn">삭제</button></td>
      </tr>
    `).join('');

    const headerCells = LIST_COLUMNS.map((col) => {
      if (!col.sortable) return `<th>${escapeHtml(col.label)}</th>`;
      const isActive = sortField === col.field;
      const arrow = isActive ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th class="sortable-th ${isActive ? 'sorted' : ''}" data-field="${escapeHtml(col.field)}">${escapeHtml(col.label)}${arrow}</th>`;
    }).join('');

    const bulkBar = selectedIds.size > 0 ? `
      <div class="bulk-action-bar">
        <span>${selectedIds.size}건 선택됨</span>
        <select id="bulk-status-select">
          <option value="">상태 일괄 변경...</option>
          ${statusOptions.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <button type="button" class="btn-outline-block" id="bulk-delete-btn">선택 삭제</button>
      </div>
    ` : '';

    container.innerHTML = `
      <div id="list-tab-bar">${filterButtons}</div>
      ${specialBanner}
      <input type="search" id="list-search" placeholder="회원카드, 회원연락처, 바코드로 검색" value="${escapeHtml(searchText)}">
      ${bulkBar}
      <table class="list-table">
        <thead>
          <tr><th><input type="checkbox" id="select-all-checkbox"></th>${headerCells}</tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="${LIST_COLUMNS.length + 1}">표시할 항목이 없습니다.</td></tr>`}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.sortable-th').forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.dataset.field;
        if (sortField === field) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDirection = 'asc';
        }
        draw();
      });
    });

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

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    selectAllCheckbox.checked = items.length > 0 && items.every((item) => selectedIds.has(item.id));
    selectAllCheckbox.addEventListener('click', (e) => e.stopPropagation());
    selectAllCheckbox.addEventListener('change', () => {
      items.forEach((item) => {
        if (selectAllCheckbox.checked) selectedIds.add(item.id);
        else selectedIds.delete(item.id);
      });
      draw();
    });

    container.querySelectorAll('.row-select-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedIds.add(checkbox.dataset.id);
        else selectedIds.delete(checkbox.dataset.id);
        draw();
      });
    });

    const bulkStatusSelect = document.getElementById('bulk-status-select');
    if (bulkStatusSelect) {
      bulkStatusSelect.addEventListener('change', async () => {
        const newStatus = bulkStatusSelect.value;
        if (!newStatus) return;
        if (!(await showConfirm(`선택한 ${selectedIds.size}건의 상태를 "${newStatus}"로 변경할까요?`))) {
          bulkStatusSelect.value = '';
          return;
        }
        const ids = Array.from(selectedIds);
        const results = await Promise.all(ids.map((id) => callApi('updateStatus', { id: id, status: newStatus })));
        ids.forEach((id, i) => {
          if (results[i].ok) {
            const item = listResult.items.find((r) => r.id === id);
            if (item) item.상태 = newStatus;
          }
        });
        selectedIds.clear();
        const failCount = results.filter((r) => !r.ok).length;
        if (failCount > 0) await showAlert(`${failCount}건 변경에 실패했습니다.`);
        draw();
      });
    }

    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', async () => {
        if (!(await showConfirm(`선택한 ${selectedIds.size}건을 삭제할까요?`))) return;
        const ids = Array.from(selectedIds);
        const results = await Promise.all(ids.map((id) => callApi('deleteAS', { id: id })));
        const failedIds = new Set();
        ids.forEach((id, i) => {
          if (results[i].ok) {
            listResult.items = listResult.items.filter((item) => item.id !== id);
          } else {
            failedIds.add(id);
          }
        });
        selectedIds = failedIds;
        if (failedIds.size > 0) await showAlert(`${failedIds.size}건 삭제에 실패했습니다.`);
        draw();
      });
    }

    sessionStorage.setItem('tabHtml_list', container.innerHTML);
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
      `<div class="status-option ${s.name === item.상태 ? 'current' : ''}" data-value="${escapeHtml(s.name)}">
        ${s.color ? `<span class="status-option-dot" style="background:${s.color}"></span>` : ''}${escapeHtml(s.name)}
      </div>`
    ).join('');

    const rect = trigger.getBoundingClientRect();
    portal.style.top = `${rect.bottom + window.scrollY + 6}px`;
    portal.style.left = `${rect.left + window.scrollX}px`;
    portal.style.maxWidth = `${document.documentElement.clientWidth - 16}px`;
    portal.hidden = false;

    const viewportRight = window.scrollX + document.documentElement.clientWidth - 8;
    const portalRight = rect.left + window.scrollX + portal.offsetWidth;
    if (portalRight > viewportRight) {
      const adjustedLeft = Math.max(window.scrollX + 8, viewportRight - portal.offsetWidth);
      portal.style.left = `${adjustedLeft}px`;
    }

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
          rowTrigger.className = 'status-chip-trigger ' + statusChipClass(newStatus);
          rowTrigger.style.cssText = statusChipStyle(newStatus);
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
      ${detailRow('상태 변경 이력', '<div id="status-history-body">불러오는 중...</div>')}
      <button type="button" class="btn-outline-block" id="list-edit-btn">수정</button>
    `;
  }

  async function loadStatusHistory_(id) {
    const result = await callApi('listStatusHistory', { id: id });
    const el = document.getElementById('status-history-body');
    if (!el) return;
    if (!result.ok || !result.items.length) {
      el.textContent = '이력이 없습니다.';
      return;
    }
    el.innerHTML = result.items.map((h) => `
      <div class="history-row">${escapeHtml(String(h.변경일시 || '').replace('T', ' ').slice(0, 16))} · ${escapeHtml(h.변경자)}: ${escapeHtml(h.이전상태 || '(없음)')} → ${escapeHtml(h.새상태)}</div>
    `).join('');
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
    loadStatusHistory_(id);

    function showView() {
      modal.querySelector('.modal-body').innerHTML = renderDetailBody(item);
      modal.querySelector('#list-edit-btn').addEventListener('click', showEdit);
      loadStatusHistory_(id);
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
