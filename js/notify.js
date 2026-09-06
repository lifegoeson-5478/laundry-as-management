function ensureAppModal_() {
  if (document.getElementById('app-modal-overlay')) return;
  const div = document.createElement('div');
  div.id = 'app-modal-overlay';
  div.className = 'app-modal-overlay';
  div.innerHTML = '<div class="app-modal"></div>';
  div.addEventListener('click', (e) => {
    if (e.target === div && div.dataset.dismissable === 'true') {
      closeAppModal();
    }
  });
  document.body.appendChild(div);
}

function closeAppModal() {
  const overlay = document.getElementById('app-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function showAlert(message) {
  ensureAppModal_();
  return new Promise((resolve) => {
    const overlay = document.getElementById('app-modal-overlay');
    overlay.dataset.dismissable = 'false';
    const modal = overlay.querySelector('.app-modal');
    modal.classList.remove('wide');
    modal.innerHTML = `
      <p class="app-modal-message">${escapeHtml(message)}</p>
      <div class="app-modal-actions">
        <button type="button" class="btn-primary-block" id="app-modal-ok">확인</button>
      </div>
    `;
    overlay.classList.add('open');
    document.getElementById('app-modal-ok').addEventListener('click', () => {
      overlay.classList.remove('open');
      resolve();
    }, { once: true });
  });
}

function showConfirm(message) {
  ensureAppModal_();
  return new Promise((resolve) => {
    const overlay = document.getElementById('app-modal-overlay');
    overlay.dataset.dismissable = 'false';
    const modal = overlay.querySelector('.app-modal');
    modal.classList.remove('wide');
    modal.innerHTML = `
      <p class="app-modal-message">${escapeHtml(message)}</p>
      <div class="app-modal-actions">
        <button type="button" class="btn-outline-block" id="app-modal-cancel">취소</button>
        <button type="button" class="btn-primary-block" id="app-modal-confirm">확인</button>
      </div>
    `;
    overlay.classList.add('open');
    document.getElementById('app-modal-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      resolve(false);
    }, { once: true });
    document.getElementById('app-modal-confirm').addEventListener('click', () => {
      overlay.classList.remove('open');
      resolve(true);
    }, { once: true });
  });
}

function showDuplicateConfirm(matches) {
  ensureAppModal_();
  return new Promise((resolve) => {
    const overlay = document.getElementById('app-modal-overlay');
    overlay.dataset.dismissable = 'false';
    const modal = overlay.querySelector('.app-modal');
    modal.classList.remove('wide');
    const rows = matches.map((m) => `
      <li>${escapeHtml(formatDateOnly(m.접수일시))} · ${escapeHtml(m.상태)} · ${escapeHtml(m.품목 || '')}</li>
    `).join('');
    modal.innerHTML = `
      <p class="app-modal-message">같은 회원카드 + 바코드번호로 이미 접수된 건이 있습니다. 중복 접수가 아닌지 확인해주세요.</p>
      <ul class="duplicate-match-list">${rows}</ul>
      <label class="duplicate-confirm-check">
        <input type="checkbox" id="duplicate-confirm-checkbox">
        중복이 아닌 것을 확인했습니다.
      </label>
      <div class="app-modal-actions">
        <button type="button" class="btn-outline-block" id="app-modal-cancel">취소</button>
        <button type="button" class="btn-primary-block" id="app-modal-confirm" disabled>접수 진행</button>
      </div>
    `;
    overlay.classList.add('open');
    const checkbox = document.getElementById('duplicate-confirm-checkbox');
    const confirmBtn = document.getElementById('app-modal-confirm');
    checkbox.addEventListener('change', () => { confirmBtn.disabled = !checkbox.checked; });
    document.getElementById('app-modal-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      resolve(false);
    }, { once: true });
    confirmBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
      resolve(true);
    }, { once: true });
  });
}

function openDetailModal(title, bodyHtml) {
  ensureAppModal_();
  const overlay = document.getElementById('app-modal-overlay');
  overlay.dataset.dismissable = 'true';
  const modal = overlay.querySelector('.app-modal');
  modal.classList.add('wide');
  modal.innerHTML = `
    <div class="modal-header">
      <h3>${escapeHtml(title)}</h3>
      <button type="button" class="modal-close-btn" id="app-modal-close-btn" aria-label="닫기">닫기</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
  `;
  overlay.classList.add('open');
  document.getElementById('app-modal-close-btn').addEventListener('click', closeAppModal, { once: true });
  return modal;
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${value}</div>
    </div>
  `;
}
