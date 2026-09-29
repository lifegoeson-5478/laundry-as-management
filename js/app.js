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
  document.getElementById('app').style.display = 'block';
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

  const existingSession = getSession();
  if (existingSession) {
    startApp(existingSession);
  } else {
    initGoogleLogin(startApp);
  }
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
