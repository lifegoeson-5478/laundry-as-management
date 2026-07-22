function getSessionSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function createSessionToken(email, name, role) {
  var payload = {
    email: email,
    name: name,
    role: role,
    exp: Date.now() + 8 * 60 * 60 * 1000 // 8시간
  };
  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadStr, getSessionSecret_())
  );
  return payloadStr + '.' + signature;
}

function verifySessionToken(token) {
  if (!token || token.indexOf('.') === -1) return null;
  var parts = token.split('.');
  var payloadStr = parts[0];
  var signature = parts[1];
  var expectedSignature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadStr, getSessionSecret_())
  );
  if (signature !== expectedSignature) return null;

  var payload = JSON.parse(Utilities.newBlob(
    Utilities.base64DecodeWebSafe(payloadStr)
  ).getDataAsString('UTF-8'));

  if (payload.exp < Date.now()) return null;
  return payload;
}

function verifyGoogleIdToken_(idToken) {
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;
  var data = JSON.parse(response.getContentText());
  return data.email ? data : null;
}

function handleLogin_(payload) {
  var googleData = verifyGoogleIdToken_(payload.idToken);
  if (!googleData) {
    return { ok: false, error: '구글 로그인 검증에 실패했습니다.' };
  }
  var staff = getAllRows('직원목록').find(function (row) {
    return row.이메일 === googleData.email;
  });
  if (!staff || String(staff.활성여부).toLowerCase() !== 'true') {
    return { ok: false, error: '등록되지 않았거나 비활성화된 계정입니다. 관리자에게 문의하세요.' };
  }
  var token = createSessionToken(staff.이메일, staff.이름, staff.역할);
  return {
    ok: true,
    session: { email: staff.이메일, name: staff.이름, role: staff.역할, token: token }
  };
}
