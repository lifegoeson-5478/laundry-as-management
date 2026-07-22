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
