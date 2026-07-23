// Apps Script 편집기에서 이 함수를 한 번 수동 실행해 시트/헤더/초기 상태값을 만든다.
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var asHeaders = [
    'id', '접수일시', '접수자', '고객분류', '회원카드', '회원연락처',
    '수거요청일자', '바코드번호', '브랜드', '품목', '품번', '생산연도',
    '사이즈', '색상', '매장위치', '브랜드AS동의일', '손상부위',
    '요청건관련메모', '런드리고배송완료처리', '상태', '현장메모'
  ];
  createSheetIfMissing_(ss, 'AS접수', asHeaders);

  var staffHeaders = ['이메일', '이름', '역할', '활성여부'];
  createSheetIfMissing_(ss, '직원목록', staffHeaders);

  var statusHeaders = ['상태명', '정렬순서', '색상'];
  var statusSheet = createSheetIfMissing_(ss, '상태값', statusHeaders);
  var initialStatuses = [
    '접수 필요', '매장 접수 완료', '회수 필요', '회수 완료',
    '중동사 접수 진행', '중동사 접수 완료',
    '아토즈레더 접수 진행', '아토즈레더 접수 완료',
    '택배 접수 진행', '택배 접수 완료',
    '택배 수령 필요', '택배 수령 완료',
    '출고 완료', '보상 종결', '그외 추가 확인 필요',
    'AS 불가', 'AS 진행중'
  ];
  if (statusSheet.getLastRow() === 1) {
    initialStatuses.forEach(function (name, i) {
      statusSheet.appendRow([name, i + 1, defaultStatusColor_(name)]);
    });
  }

  Logger.log('Setup complete');
}

function defaultStatusColor_(name) {
  if (name.indexOf('AS 불가') !== -1) return '#e03e3e';
  if (name.indexOf('종결') !== -1) return '#9aa0ad';
  if (name.indexOf('완료') !== -1) return '#10b981';
  if (name.indexOf('필요') !== -1) return '#f59e0b';
  if (name.indexOf('진행') !== -1) return '#00a991';
  return '#9aa0ad';
}

function createSheetIfMissing_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}
