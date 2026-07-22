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
        alert(result.error || '로그인에 실패했습니다.');
      }
    }
  });
  google.accounts.id.renderButton(
    document.getElementById('google-login-button'),
    { theme: 'outline', size: 'large' }
  );
}
