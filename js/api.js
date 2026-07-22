async function callApi(action, payload) {
  const session = getSession();
  const body = {
    action: action,
    payload: Object.assign({}, payload, { token: session ? session.token : null })
  };
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '서버와 통신할 수 없습니다. 네트워크를 확인해주세요.' };
  }
}
