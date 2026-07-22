function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireSession_(payload) {
  var session = verifySessionToken(payload.token);
  if (!session) throw new Error('로그인이 필요하거나 세션이 만료되었습니다.');
  return session;
}

function requireAdmin_(payload) {
  var session = requireSession_(payload);
  if (session.role !== '관리자') throw new Error('관리자만 사용할 수 있는 기능입니다.');
  return session;
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: '잘못된 요청 형식입니다.' });
  }

  var action = body.action;
  var payload = body.payload || {};

  try {
    switch (action) {
      case 'login':
        return jsonResponse(handleLogin_(payload));
      case 'submitAS':
        return jsonResponse(handleSubmitAS_(payload));
      case 'listAS':
        return jsonResponse(handleListAS_(payload));
      default:
        return jsonResponse({ ok: false, error: '알 수 없는 action입니다: ' + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}
