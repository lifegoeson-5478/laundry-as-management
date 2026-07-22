function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadgeClass(status) {
  if (!status) return 'badge-neutral';
  if (status === 'AS 불가') return 'badge-danger';
  if (status.indexOf('종결') !== -1) return 'badge-neutral';
  if (status.indexOf('완료') !== -1) return 'badge-success';
  if (status.indexOf('필요') !== -1) return 'badge-warning';
  if (status.indexOf('진행') !== -1) return 'badge-brand';
  return 'badge-neutral';
}

function statusBadge(status) {
  return `<span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>`;
}

function formatDateOnly(str) {
  if (!str) return '';
  const s = String(str);
  const idx = s.indexOf('T');
  return idx !== -1 ? s.slice(0, idx) : s;
}

function computeAgingBucketClient(pickupDateStr, todayDate) {
  const pickup = new Date(pickupDateStr);
  const today = todayDate || new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((today.getTime() - pickup.getTime()) / msPerDay);
  const weeksElapsed = daysElapsed / 7;

  if (weeksElapsed <= 2) return '2주 이하';
  if (weeksElapsed <= 3) return '3주 이상';
  if (weeksElapsed <= 4) return '4주 이상';
  if (weeksElapsed <= 5) return '5주 이상';
  return '5주 초과';
}
