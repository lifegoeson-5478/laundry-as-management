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
