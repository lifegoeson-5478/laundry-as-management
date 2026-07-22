// 순수 함수만 포함. SpreadsheetApp 등 Apps Script 전용 API를 사용하지 않는다.
// 이 파일은 Node의 vm 모듈로도 그대로 로드되므로 전역 함수/변수로만 정의한다.

var FIELD_STATUS_MAP = {
  'AS불가': 'AS 불가',
  '진행중': 'AS 진행중',
  '수거완료': '회수 완료'
};

function computeAgingBucket(pickupDateStr, todayDate) {
  var pickup = new Date(pickupDateStr);
  var today = todayDate || new Date();
  var msPerDay = 24 * 60 * 60 * 1000;
  var daysElapsed = Math.floor((today.getTime() - pickup.getTime()) / msPerDay);
  var weeksElapsed = daysElapsed / 7;

  if (weeksElapsed <= 2) return '2주 이하';
  if (weeksElapsed <= 3) return '3주 이상';
  if (weeksElapsed <= 4) return '4주 이상';
  if (weeksElapsed <= 5) return '5주 이상';
  return '5주 초과';
}

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function (header, i) {
    obj[header] = row[i];
  });
  return obj;
}

function objectToRow(headers, obj) {
  return headers.map(function (header) {
    return obj[header] !== undefined ? obj[header] : '';
  });
}
