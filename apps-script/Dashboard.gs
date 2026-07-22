function handleDashboard_(payload) {
  requireSession_(payload);
  var rows = getAllRows('AS접수');
  var today = new Date();

  var needIntake = rows.filter(function (r) { return r.상태 === '접수 필요'; }).length;
  var needPickup = rows.filter(function (r) { return r.상태 === '회수 필요'; }).length;

  var agingBuckets = { '2주 이하': 0, '3주 이상': 0, '4주 이상': 0, '5주 이상': 0, '5주 초과': 0 };
  var openRows = rows.filter(function (r) {
    return r.상태 !== '출고 완료' && r.상태 !== '보상 종결';
  });
  openRows.forEach(function (r) {
    if (!r.수거요청일자) return;
    var bucket = computeAgingBucket(r.수거요청일자, today);
    agingBuckets[bucket]++;
  });

  var byStaff = {};
  openRows.forEach(function (r) {
    var name = r.접수자 || '(미상)';
    byStaff[name] = (byStaff[name] || 0) + 1;
  });

  var byCustomerType = {};
  openRows.forEach(function (r) {
    var type = r.고객분류 || '(미상)';
    byCustomerType[type] = (byCustomerType[type] || 0) + 1;
  });

  return {
    ok: true,
    needIntake: needIntake,
    needPickup: needPickup,
    agingBuckets: agingBuckets,
    byStaff: byStaff,
    byCustomerType: byCustomerType,
    totalCount: rows.length,
    totalOpen: openRows.length,
    totalClosed: rows.length - openRows.length
  };
}
