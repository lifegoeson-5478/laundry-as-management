const TAB_RENDERERS = {
  dashboard: renderDashboardTab,
  intake: renderIntakeTab,
  list: renderListTab,
  field: renderFieldTab,
  settings: renderSettingsTab
};

const TAB_HEADS = {
  dashboard: ['AS / DASHBOARD', '대시보드'],
  intake: ['AS / INTAKE', 'AS 접수'],
  list: ['AS / LIST', '접수 목록'],
  field: ['AS / FIELD', '현장 처리'],
  settings: ['AS / ADMIN', '어드민']
};

let activeTab = null;

function showTab(tabName, params) {
  document.querySelectorAll('#tab-nav button[data-tab]').forEach((btn) => {
    btn.classList.toggle('current', btn.dataset.tab === tabName);
  });
  activeTab = tabName;
  document.getElementById('page-kicker').textContent = TAB_HEADS[tabName][0];
  document.getElementById('page-title-text').textContent = TAB_HEADS[tabName][1];
  // 탭을 바꿀 때마다 제목·내용 등장 모션을 다시 재생
  document.querySelectorAll('.page-title, .page-title .hero-dot, #tab-content').forEach((el) => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });
  document.getElementById('tab-content').innerHTML = '';
  TAB_RENDERERS[tabName](document.getElementById('tab-content'), params);
}

function startApp(session) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('brand-mark').addEventListener('click', (e) => {
    e.preventDefault();
    showTab('dashboard');
  });
  if (session.role === '관리자') {
    document.getElementById('settings-tab-button').style.display = 'inline-block';
  }
  document.querySelectorAll('#tab-nav button[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  document.getElementById('logout-button').addEventListener('click', () => {
    clearSession();
    location.reload();
  });
  showTab('dashboard');
}

function init() {
  const now = new Date();
  const today = now.toLocaleDateString('sv-SE').replace(/-/g, '.') + ' ' +
    now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  document.querySelectorAll('.js-today').forEach((el) => { el.textContent = today; });
  document.getElementById('app-version').textContent = 'v' + APP_VERSION;

  const existingSession = getSession();
  if (existingSession) {
    startApp(existingSession);
  } else {
    initGoogleLogin(startApp);
  }
}

// ============================================================
// 새 버전 배포 감지 → 자동 새로고침 (매장 정보 시스템처럼 1분마다 확인)
// config.js의 APP_VERSION이 바뀌면 새 배포로 본다. 입력 중이면 다음 확인 때로 미룬다.
// ============================================================
function isUserEditing_() {
  if (document.querySelector('.app-modal-overlay.open')) return true;
  const focused = document.activeElement;
  if (focused && focused.matches('input, textarea, select')) return true;
  const intake = document.getElementById('intake-form');
  return !!intake && [...intake.querySelectorAll('input:not([type=hidden]), textarea')].some((el) => el.value);
}

async function checkForNewVersion_() {
  try {
    // cache: 'reload' → 네트워크에서 새로 받고 브라우저 캐시도 갱신
    const text = await (await fetch('js/config.js', { cache: 'reload' })).text();
    const match = text.match(/APP_VERSION = '([^']+)'/);
    if (!match || match[1] === APP_VERSION || isUserEditing_()) return;
    // GitHub Pages가 파일을 10분간 캐시하므로, 새로고침 전에 JS·CSS를 새로 받아 둔다
    const assets = [...document.querySelectorAll('script[src^="js/"], link[href^="css/"]')].map((el) => el.src || el.href);
    await Promise.all(assets.map((url) => fetch(url, { cache: 'reload' })));
    showToast_('새 버전(v' + match[1] + ')이 배포되어 새로고침합니다');
    setTimeout(() => location.reload(), 1200);
  } catch (err) { /* 오프라인 등 — 다음 주기에 다시 시도 */ }
}
setInterval(checkForNewVersion_, 60000);

function showToast_(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
