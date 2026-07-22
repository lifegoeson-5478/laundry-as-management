const FIELD_STATUS_BUTTONS = ['AS불가', '진행중', '수거완료'];

const FIELD_SECTIONS = [
  ['접수 필요', (item) => item.상태 === '접수 필요'],
  ['회수 필요', (item) => item.상태 === '회수 필요'],
  ['그 외 진행중', (item) => item.상태 !== '접수 필요' && item.상태 !== '회수 필요']
];

let fieldItemsById = {};

function renderFieldRow(item) {
  return `
    <div class="field-row" data-id="${escapeHtml(item.id)}">
      <strong>${escapeHtml(item.브랜드)}</strong>
      <div>회원카드: ${escapeHtml(item.회원카드)} · 바코드번호: ${escapeHtml(item.바코드번호)}</div>
      <div>손상부위: ${escapeHtml(item.손상부위)}</div>
      <div>매장위치: ${escapeHtml(item.매장위치)} · 현재상태: ${escapeHtml(item.상태)}</div>
    </div>
  `;
}

async function renderFieldTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';
  const result = await callApi('listAS', {});
  if (!result.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const openItems = result.items.filter((item) =>
    item.상태 !== '출고 완료' && item.상태 !== '보상 종결'
  );
  fieldItemsById = {};
  openItems.forEach((item) => { fieldItemsById[item.id] = item; });

  const sectionsHtml = FIELD_SECTIONS.map(([title, filterFn]) => {
    const items = openItems.filter(filterFn);
    const rows = items.map(renderFieldRow).join('');
    return `
      <h2>${escapeHtml(title)} (${items.length})</h2>
      <div class="field-row-list">${rows || '<div>표시할 항목이 없습니다.</div>'}</div>
    `;
  }).join('');

  container.innerHTML = `
    ${sectionsHtml}
    <div id="field-modal-overlay" style="display:none;">
      <div id="field-modal">
        <button id="field-modal-close">닫기</button>
        <div id="field-modal-body"></div>
      </div>
    </div>
  `;

  container.querySelectorAll('.field-row').forEach((row) => {
    row.addEventListener('click', () => openFieldModal(row.dataset.id));
  });

  document.getElementById('field-modal-close').addEventListener('click', closeFieldModal);
}

function openFieldModal(id) {
  const item = fieldItemsById[id];
  const overlay = document.getElementById('field-modal-overlay');
  const body = document.getElementById('field-modal-body');

  const buttons = FIELD_STATUS_BUTTONS.map((label) =>
    `<button class="field-status-btn" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
  ).join('');

  body.innerHTML = `
    <div data-id="${escapeHtml(item.id)}" data-selected-status="">
      <div><strong>브랜드:</strong> ${escapeHtml(item.브랜드)}</div>
      <div><strong>회원카드:</strong> ${escapeHtml(item.회원카드)}</div>
      <div><strong>바코드번호:</strong> ${escapeHtml(item.바코드번호)}</div>
      <div><strong>손상부위:</strong> ${escapeHtml(item.손상부위)}</div>
      <div><strong>현재상태:</strong> ${escapeHtml(item.상태)}</div>
      <div class="field-buttons">${buttons}</div>
      <textarea class="field-memo" placeholder="메모">${escapeHtml(item.현장메모 || '')}</textarea>
      <button class="field-save-btn">저장</button>
    </div>
  `;

  const detail = body.firstElementChild;
  detail.querySelectorAll('.field-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      detail.dataset.selectedStatus = btn.dataset.label;
      detail.querySelectorAll('.field-status-btn').forEach((b) => {
        b.classList.toggle('selected', b === btn);
      });
    });
  });

  detail.querySelector('.field-save-btn').addEventListener('click', async () => {
    const fieldStatus = detail.dataset.selectedStatus;
    if (!fieldStatus) {
      alert('저장할 상태를 먼저 선택해주세요.');
      return;
    }
    const memo = detail.querySelector('.field-memo').value;
    const result = await callApi('fieldUpdate', {
      id: detail.dataset.id,
      fieldStatus: fieldStatus,
      memo: memo
    });
    if (result.ok) {
      alert('저장되었습니다.');
      closeFieldModal();
    } else {
      alert('저장 실패: ' + result.error);
    }
  });

  overlay.style.display = 'flex';
}

function closeFieldModal() {
  document.getElementById('field-modal-overlay').style.display = 'none';
}
