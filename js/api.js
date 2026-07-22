async function callApi(action, payload) {
  const session = getSession();
  const body = {
    action: action,
    payload: Object.assign({}, payload, { token: session ? session.token : null })
  };
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, error: '서버와 통신할 수 없습니다. 네트워크를 확인해주세요. (' + err.message + ')' };
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: '서버 응답을 해석할 수 없습니다. (HTTP ' + res.status + ') ' + text.slice(0, 200)
    };
  }
}
