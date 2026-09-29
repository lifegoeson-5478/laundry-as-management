const SESSION_KEY = 'as_session';

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.exp && session.exp < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch (err) {
    return null;
  }
}

function setSession(session) {
  const withExp = Object.assign({}, session, { exp: Date.now() + 8 * 60 * 60 * 1000 });
  localStorage.setItem(SESSION_KEY, JSON.stringify(withExp));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function initGoogleLogin(onSuccess) {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response) => {
      const result = await callApi('login', { idToken: response.credential });
      if (result.ok) {
        setSession(result.session);
        onSuccess(result.session);
      } else {
        await showAlert(result.error || '로그인에 실패했습니다.');
      }
    }
  });
  const buttonEl = document.getElementById('google-login-button');
  google.accounts.id.renderButton(buttonEl, {
    theme: 'outline', size: 'large', shape: 'rectangular', text: 'signin_with',
    width: Math.min(buttonEl.clientWidth, 400) // Google 버튼 최대 폭 400px
  });
}
