// 시트 → Supabase 1회 이전용. 스크립트 속성에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 넣고
// Apps Script 편집기에서 migrateToSupabase를 한 번 실행한다. 다시 실행해도 같은 id는 덮어쓴다.
var MIGRATE_TIMESTAMP_COLS = ['접수일시', '변경일시'];

function migrateToSupabase() {
  migrateSheet_('AS접수', 'id', function (r) { return r.id; });
  migrateSheet_('직원목록', '이메일', function (r) { return r.이메일; }, function (r) {
    r.활성여부 = String(r.활성여부).toLowerCase() === 'true';
  });
  migrateSheet_('상태변경이력', 'id', function (r) { return r.대상id; }, function (r) {
    if (!r.id) r.id = Utilities.getUuid();
  });
  migrateSheet_('상태값', '상태명', function (r) { return r.상태명; }, function (r) {
    r.정렬순서 = Number(r.정렬순서) || 0;
  });
}

function migrateSheet_(sheetName, conflictCol, isValidRow, fixRow) {
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)) {
    Logger.log(sheetName + ': 시트 없음, 건너뜀');
    return;
  }
  var rows = getAllRows(sheetName).filter(isValidRow).map(function (r) {
    delete r._row;
    Object.keys(r).forEach(function (key) {
      var v = r[key];
      if (v instanceof Date) {
        r[key] = MIGRATE_TIMESTAMP_COLS.indexOf(key) !== -1
          ? v.toISOString()
          : Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      } else if (MIGRATE_TIMESTAMP_COLS.indexOf(key) !== -1) {
        r[key] = v ? String(v) : null;
      } else {
        r[key] = v === null || v === undefined ? '' : String(v);
      }
    });
    if (fixRow) fixRow(r);
    return r;
  });

  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL') + '/rest/v1/' + encodeURIComponent(sheetName)
    + '?on_conflict=' + encodeURIComponent(conflictCol);
  var key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || !props.getProperty('SUPABASE_URL')) {
    throw new Error('스크립트 속성에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 먼저 넣어주세요.');
  }

  for (var i = 0; i < rows.length; i += 500) {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(rows.slice(i, i + 500)),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) {
      throw new Error(sheetName + ' 이전 실패 (' + res.getResponseCode() + '): ' + res.getContentText());
    }
  }
  Logger.log(sheetName + ': ' + rows.length + '행 이전 완료');
}
