const FIELD_CONTACT = { name: '최인영', phone: '010-8488-5416' };

const FIELD_STATUS_BUTTONS = ['AS불가', '진행중', '수거완료'];

const FIELD_SECTIONS = [
  ['접수 필요', (item) => item.상태 === '접수 필요'],
  ['회수 필요', (item) => item.상태 === '회수 필요']
];

let fieldItemsById = {};

function renderFieldRow(item) {
  return `
    <div class="field-row" data-id="${escapeHtml(item.id)}">
      <div class="field-row-main">
        <strong>${escapeHtml(item.회원카드)}</strong>
        <div class="field-row-sub">브랜드 ${escapeHtml(item.브랜드)} · 바코드 ${escapeHtml(item.바코드번호)} · ${escapeHtml(item.매장위치)} · ${escapeHtml(item.손상부위)}</div>
      </div>
      ${statusBadge(item.상태)}
    </div>
  `;
}

async function renderFieldTab(container, params) {
  container.innerHTML = loadingScreen('현장 처리 목록을 불러오고 있어요');
  const [result] = await Promise.all([callApi('listAS', {}), getStatusOptions()]);
  if (!result.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const openItems = result.items.filter((item) =>
    item.상태 !== '출고 완료' && item.상태 !== '보상 종결'
  );
  fieldItemsById = {};
  openItems.forEach((item) => { fieldItemsById[item.id] = item; });

  let currentSection = (params && params.section) || FIELD_SECTIONS[0][0];

  function draw() {
    const tabButtons = FIELD_SECTIONS.map(([title]) =>
      `<button class="list-tab ${title === currentSection ? 'active' : ''}" data-section="${escapeHtml(title)}">${escapeHtml(title)}</button>`
    ).join('');

    const [, filterFn] = FIELD_SECTIONS.find(([title]) => title === currentSection);
    const items = openItems.filter(filterFn);
    const rows = items.map(renderFieldRow).join('');

    container.innerHTML = `
      <div class="field-contact-card">
        <div class="field-contact-icon">☎</div>
        <div class="field-contact-info">
          <div class="field-contact-label">담당자</div>
          <div class="field-contact-main">${escapeHtml(FIELD_CONTACT.name)} · ${escapeHtml(FIELD_CONTACT.phone)}</div>
        </div>
      </div>
      <div id="list-tab-bar">${tabButtons}</div>
      <div class="field-row-list">${rows || '<div class="field-empty">표시할 항목이 없습니다.</div>'}</div>
    `;

    container.querySelectorAll('#list-tab-bar button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSection = btn.dataset.section;
        draw();
      });
    });

    container.querySelectorAll('.field-row').forEach((row) => {
      row.addEventListener('click', () => openFieldModal(row.dataset.id));
    });
  }

  draw();
}

function openFieldModal(id) {
  const item = fieldItemsById[id];

  const buttons = FIELD_STATUS_BUTTONS.map((label) =>
    `<button class="field-status-btn" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
  ).join('');

  const bodyHtml = `
    <div id="field-detail" data-id="${escapeHtml(item.id)}" data-selected-status="">
      <div class="detail-grid">
        ${detailRow('브랜드', escapeHtml(item.브랜드))}
        ${detailRow('회원카드', escapeHtml(item.회원카드))}
        ${detailRow('바코드번호', escapeHtml(item.바코드번호))}
        ${detailRow('손상부위', escapeHtml(item.손상부위))}
        ${detailRow('현재상태', statusBadge(item.상태))}
      </div>
      <div class="detail-row">
        <div class="detail-label">진행 상태 선택</div>
        <div class="field-buttons chip-group">${buttons}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">메모</div>
        <textarea class="field-memo" placeholder="메모">${escapeHtml(item.현장메모 || '')}</textarea>
      </div>
      <button type="button" class="btn-primary-block field-save-btn">저장</button>
    </div>
  `;

  const modal = openDetailModal('진행 상태 업데이트', bodyHtml);
  const detail = modal.querySelector('#field-detail');

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
      await showAlert('저장할 상태를 먼저 선택해주세요.');
      return;
    }
    const memo = detail.querySelector('.field-memo').value;
    const result = await callApi('fieldUpdate', {
      id: detail.dataset.id,
      fieldStatus: fieldStatus,
      memo: memo
    });
    if (result.ok) {
      await showAlert('저장되었습니다.');
      closeAppModal();
    } else {
      await showAlert('저장 실패: ' + result.error);
    }
  });
}
