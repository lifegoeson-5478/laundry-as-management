function handleListStaff_(payload) {
  requireAdmin_(payload);
  return { ok: true, items: getAllRows('직원목록') };
}

function handleAddStaff_(payload) {
  requireAdmin_(payload);
  var form = payload.form || {};
  if (!form.이메일 || !form.이름) {
    return { ok: false, error: '이메일과 이름은 필수입니다.' };
  }
  var exists = getAllRows('직원목록').some(function (r) { return r.이메일 === form.이메일; });
  if (exists) return { ok: false, error: '이미 등록된 이메일입니다.' };

  appendRowObject('직원목록', {
    이메일: form.이메일,
    이름: form.이름,
    역할: form.역할 === '관리자' ? '관리자' : '일반',
    활성여부: true
  });
  return { ok: true };
}

function handleUpdateStaff_(payload) {
  requireAdmin_(payload);
  if (!payload.email) return { ok: false, error: 'email이 필요합니다.' };

  var sheet = getSheet_('직원목록');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailCol = headers.indexOf('이메일');
  for (var i = 1; i < values.length; i++) {
    if (values[i][emailCol] === payload.email) {
      Object.keys(payload.updates || {}).forEach(function (key) {
        var col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(payload.updates[key]);
      });
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 이메일을 찾을 수 없습니다.' };
}

function handleDeleteStaff_(payload) {
  var session = requireAdmin_(payload);
  if (!payload.email) return { ok: false, error: 'email이 필요합니다.' };
  if (payload.email === session.email) {
    return { ok: false, error: '본인 계정은 삭제할 수 없습니다.' };
  }

  var sheet = getSheet_('직원목록');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailCol = headers.indexOf('이메일');
  for (var i = 1; i < values.length; i++) {
    if (values[i][emailCol] === payload.email) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 이메일을 찾을 수 없습니다.' };
}
