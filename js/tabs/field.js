const FIELD_STATUS_BUTTONS = ['AS불가', '진행중', '수거완료'];

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

  const cards = openItems.map((item) => {
    const buttons = FIELD_STATUS_BUTTONS.map((label) =>
      `<button class="field-status-btn" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
    ).join('');
    return `
      <div class="card" data-id="${escapeHtml(item.id)}" data-selected-status="">
        <strong>${escapeHtml(item.브랜드)}</strong> / ${escapeHtml(item.품목)}
        <div>매장위치: ${escapeHtml(item.매장위치)} · 현재상태: ${escapeHtml(item.상태)}</div>
        <div class="field-buttons">${buttons}</div>
        <textarea class="field-memo" placeholder="메모">${escapeHtml(item.현장메모 || '')}</textarea>
        <button class="field-save-btn">저장</button>
      </div>
    `;
  }).join('');

  container.innerHTML = cards || '<div>표시할 항목이 없습니다.</div>';

  container.querySelectorAll('.field-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      card.dataset.selectedStatus = btn.dataset.label;
      card.querySelectorAll('.field-status-btn').forEach((b) => {
        b.classList.toggle('selected', b === btn);
      });
    });
  });

  container.querySelectorAll('.field-save-btn').forEach((saveBtn) => {
    saveBtn.addEventListener('click', async () => {
      const card = saveBtn.closest('.card');
      const id = card.dataset.id;
      const fieldStatus = card.dataset.selectedStatus;
      if (!fieldStatus) {
        alert('저장할 상태를 먼저 선택해주세요.');
        return;
      }
      const memo = card.querySelector('.field-memo').value;
      const result = await callApi('fieldUpdate', {
        id: id,
        fieldStatus: fieldStatus,
        memo: memo
      });
      if (result.ok) {
        alert('저장되었습니다.');
      } else {
        alert('저장 실패: ' + result.error);
      }
    });
  });
}
