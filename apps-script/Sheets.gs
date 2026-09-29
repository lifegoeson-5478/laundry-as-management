function getCache_(key) {
  var cached = CacheService.getScriptCache().get(key);
  return cached ? JSON.parse(cached) : null;
}

function setCache_(key, value, ttlSeconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    // 캐시 용량(100KB) 초과 시 그냥 캐싱을 건너뜀
  }
}

function clearCache_(keys) {
  CacheService.getScriptCache().removeAll(keys);
}

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sheet;
}

function getAllRows(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject(headers, values[i]);
    obj._row = i + 1; // 1-based, 헤더 포함 실제 시트 행 번호
    rows.push(obj);
  }
  return rows;
}

function appendRowObject(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(objectToRow(headers, obj));
}

function updateRowById(sheetName, id, updates) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      Object.keys(updates).forEach(function (key) {
        var col = headers.indexOf(key);
        if (col !== -1) {
          sheet.getRange(i + 1, col + 1).setValue(updates[key]);
        }
      });
      return true;
    }
  }
  return false;
}

function logStatusChange_(asId, actorName, oldStatus, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheetIfMissing_(ss, '상태변경이력', ['id', '대상id', '변경일시', '변경자', '이전상태', '새상태']);
  appendRowObject('상태변경이력', {
    id: Utilities.getUuid(),
    대상id: asId,
    변경일시: new Date().toISOString(),
    변경자: actorName,
    이전상태: oldStatus || '',
    새상태: newStatus
  });
}

function deleteRowById(sheetName, id) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}
