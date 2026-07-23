var AS_REQUIRED_FIELDS = [
  '고객분류', '회원카드', '회원연락처', '수거요청일자', '바코드번호',
  '브랜드', '품목', '품번', '생산연도', '사이즈', '색상',
  '매장위치', '브랜드AS동의일', '손상부위'
];

function handleSubmitAS_(payload) {
  var session = requireSession_(payload);
  var form = payload.form || {};

  var missing = AS_REQUIRED_FIELDS.filter(function (field) {
    return !form[field];
  });
  if (missing.length > 0) {
    return { ok: false, error: '필수 항목이 비어있습니다: ' + missing.join(', ') };
  }

  var record = {
    id: Utilities.getUuid(),
    접수일시: new Date().toISOString(),
    접수자: session.name,
    고객분류: form.고객분류,
    회원카드: form.회원카드,
    회원연락처: form.회원연락처,
    수거요청일자: form.수거요청일자,
    바코드번호: form.바코드번호,
    브랜드: form.브랜드,
    품목: form.품목,
    품번: form.품번,
    생산연도: form.생산연도,
    사이즈: form.사이즈,
    색상: form.색상,
    매장위치: form.매장위치,
    브랜드AS동의일: form.브랜드AS동의일,
    손상부위: form.손상부위,
    요청건관련메모: form.요청건관련메모 || '',
    런드리고배송완료처리: form.고객분류 === '런드리고' ? (form.런드리고배송완료처리 || '') : '',
    상태: '접수 필요',
    현장메모: ''
  };

  appendRowObject('AS접수', record);
  return { ok: true, record: record };
}

function handleListAS_(payload) {
  requireSession_(payload);
  var rows = getAllRows('AS접수');
  rows.sort(function (a, b) {
    return new Date(a.접수일시) - new Date(b.접수일시);
  });
  return { ok: true, items: rows };
}

var AS_EDITABLE_FIELDS = [
  '고객분류', '회원카드', '회원연락처', '수거요청일자', '바코드번호',
  '브랜드', '품목', '품번', '생산연도', '사이즈', '색상',
  '매장위치', '브랜드AS동의일', '손상부위', '요청건관련메모', '런드리고배송완료처리'
];

function handleUpdateAS_(payload) {
  requireSession_(payload);
  if (!payload.id) return { ok: false, error: 'id가 필요합니다.' };
  var form = payload.form || {};
  var updates = {};
  AS_EDITABLE_FIELDS.forEach(function (field) {
    if (form[field] !== undefined) updates[field] = form[field];
  });
  var updated = updateRowById('AS접수', payload.id, updates);
  if (!updated) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

function handleDeleteAS_(payload) {
  requireSession_(payload);
  if (!payload.id) return { ok: false, error: 'id가 필요합니다.' };
  var deleted = deleteRowById('AS접수', payload.id);
  if (!deleted) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

function handleUpdateStatus_(payload) {
  requireSession_(payload);
  if (!payload.id || !payload.status) {
    return { ok: false, error: 'id와 status가 필요합니다.' };
  }
  var updated = updateRowById('AS접수', payload.id, { 상태: payload.status });
  if (!updated) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

function handleFieldUpdate_(payload) {
  var session = requireSession_(payload);
  if (!payload.id || !payload.fieldStatus) {
    return { ok: false, error: 'id와 fieldStatus가 필요합니다.' };
  }
  var mappedStatus = FIELD_STATUS_MAP[payload.fieldStatus];
  if (!mappedStatus) {
    return { ok: false, error: '알 수 없는 현장 상태입니다: ' + payload.fieldStatus };
  }
  var updated = updateRowById('AS접수', payload.id, {
    상태: mappedStatus,
    현장메모: payload.memo || ''
  });
  if (!updated) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };

  var item = getAllRows('AS접수').find(function (r) { return r.id === payload.id; });
  var mention = mentionForStaffName_(item ? item.접수자 : '');
  var laundry = [item ? item.브랜드 : '', item ? item.품목 : '', item ? item.색상 : '', item ? item.손상부위 : '']
    .filter(function (v) { return v; })
    .join(' / ');

  var messageLines = [
    '📦 현장 업데이트',
    '담당자: ' + mention,
    '회원카드: ' + (item ? item.회원카드 : ''),
    '회원번호: ' + (item ? item.회원연락처 : ''),
    '바코드: ' + (item ? item.바코드번호 : ''),
    'AS 세탁물: ' + laundry,
    '상태: ' + mappedStatus,
    '메모: ' + (payload.memo || '')
  ];
  sendSlackMessage_(messageLines.join('\n'));

  return { ok: true };
}
