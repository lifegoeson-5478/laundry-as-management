function ensureStatusColorColumns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colorCol = headers.indexOf('색상');
  if (colorCol === -1) {
    colorCol = headers.length;
    sheet.getRange(1, colorCol + 1).setValue('색상');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  var textColorCol = headers.indexOf('글자색');
  if (textColorCol === -1) {
    textColorCol = headers.length;
    sheet.getRange(1, textColorCol + 1).setValue('글자색');
  }
  return { colorCol: colorCol, textColorCol: textColorCol };
}

function handleListStatus_(payload) {
  requireSession_(payload);
  var rows = getAllRows('상태값');
  rows.sort(function (a, b) { return a.정렬순서 - b.정렬순서; });
  return {
    ok: true,
    items: rows.map(function (r) {
      return { name: r.상태명, color: r.색상 || '', textColor: r.글자색 || '' };
    })
  };
}

function handleAddStatus_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  var color = payload.color || '';
  var textColor = payload.textColor || '';
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var sheet = getSheet_('상태값');
  ensureStatusColorColumns_(sheet);

  var rows = getAllRows('상태값');
  if (rows.some(function (r) { return r.상태명 === name; })) {
    return { ok: false, error: '이미 존재하는 상태값입니다.' };
  }
  var maxOrder = rows.reduce(function (max, r) { return Math.max(max, r.정렬순서 || 0); }, 0);
  appendRowObject('상태값', { 상태명: name, 정렬순서: maxOrder + 1, 색상: color, 글자색: textColor });
  return { ok: true };
}

function handleDeleteStatus_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var sheet = getSheet_('상태값');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var nameCol = headers.indexOf('상태명');
  for (var i = 1; i < values.length; i++) {
    if (values[i][nameCol] === name) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 상태값을 찾을 수 없습니다.' };
}

function handleUpdateStatusColor_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  var color = payload.color || '';
  var textColor = payload.textColor || '';
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var sheet = getSheet_('상태값');
  var cols = ensureStatusColorColumns_(sheet);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var nameCol = headers.indexOf('상태명');
  for (var i = 1; i < values.length; i++) {
    if (values[i][nameCol] === name) {
      sheet.getRange(i + 1, cols.colorCol + 1).setValue(color);
      sheet.getRange(i + 1, cols.textColorCol + 1).setValue(textColor);
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 상태값을 찾을 수 없습니다.' };
}
