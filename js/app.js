const TAB_RENDERERS = {
  dashboard: renderDashboardTab,
  intake: renderIntakeTab,
  list: renderListTab,
  field: renderFieldTab,
  settings: renderSettingsTab
};

function showTab(tabName, params) {
  document.querySelectorAll('#tab-nav button[data-tab]').forEach((btn) => {
    btn.classList.toggle('current', btn.dataset.tab === tabName);
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
