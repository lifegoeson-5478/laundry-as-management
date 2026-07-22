function ensureAppModal_() {
  if (document.getElementById('app-modal-overlay')) return;
  const div = document.createElement('div');
  div.id = 'app-modal-overlay';
  div.className = 'app-modal-overlay';
  div.innerHTML = `
    <div class="app-modal">
      <p id="app-modal-message"></p>
      <div id="app-modal-actions" class="app-modal-actions"></div>
    </div>
  `;
  document.body.appendChild(div);
}

function showAlert(message) {
  ensureAppModal_();
  return new Promise((resolve) => {
    const overlay = document.getElementById('app-modal-overlay');
    document.getElementById('app-modal-message').textContent = message;
    const actions = document.getElementById('app-modal-actions');
    actions.innerHTML = '<button type="button" class="btn-primary-block" id="app-modal-ok">확인</button>';
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
    document.getElementById('app-modal-message').textContent = message;
    const actions = document.getElementById('app-modal-actions');
    actions.innerHTML = `
      <button type="button" class="btn-outline-block" id="app-modal-cancel">취소</button>
      <button type="button" class="btn-primary-block" id="app-modal-confirm">확인</button>
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
