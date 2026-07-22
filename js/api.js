async function callApi(action, payload) {
  const session = getSession();
  const body = {
    action: action,
    payload: Object.assign({}, payload, { token: session ? session.token : null })
  };
  const start = performance.now();
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.log('[callApi]', action, Math.round(performance.now() - start) + 'ms', 'FETCH_ERROR');
    return { ok: false, error: '서버와 통신할 수 없습니다. 네트워크를 확인해주세요. (' + err.message + ')' };
  }

  const text = await res.text();
  console.log('[callApi]', action, Math.round(performance.now() - start) + 'ms');
  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: '서버 응답을 해석할 수 없습니다. (HTTP ' + res.status + ') ' + text.slice(0, 200)
    };
  }
}
