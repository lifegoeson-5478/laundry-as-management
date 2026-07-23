// 접수일시가 6개월 지난 AS접수 건을 상태와 상관없이 자동 삭제한다.
function cleanupOldRecords() {
  var sheet = getSheet_('AS접수');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var dateCol = headers.indexOf('접수일시');

  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  var deletedCount = 0;
  for (var i = values.length - 1; i >= 1; i--) {
    var dateVal = values[i][dateCol];
    if (!dateVal) continue;
    var recordDate = new Date(dateVal);
    if (recordDate < cutoff) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  Logger.log('삭제된 건수: ' + deletedCount);
}

// Apps Script 편집기에서 이 함수를 한 번만 수동 실행해 매일 자동 정리 트리거를 등록한다.
function createDailyCleanupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanupOldRecords') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('cleanupOldRecords')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('매일 새벽 3시 자동 정리 트리거가 등록되었습니다.');
}
