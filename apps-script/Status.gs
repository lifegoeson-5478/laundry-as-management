function handleListStatus_(payload) {
  requireSession_(payload);
  var rows = getAllRows('상태값');
  rows.sort(function (a, b) { return a.정렬순서 - b.정렬순서; });
  return { ok: true, items: rows.map(function (r) { return r.상태명; }) };
}

function handleAddStatus_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var rows = getAllRows('상태값');
  if (rows.some(function (r) { return r.상태명 === name; })) {
    return { ok: false, error: '이미 존재하는 상태값입니다.' };
  }
  var maxOrder = rows.reduce(function (max, r) { return Math.max(max, r.정렬순서 || 0); }, 0);
  appendRowObject('상태값', { 상태명: name, 정렬순서: maxOrder + 1 });
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
