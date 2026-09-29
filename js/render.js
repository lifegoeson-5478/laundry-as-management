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
  const color = statusColorFor(status);
  if (color) {
    return `<span class="badge" style="background:${color};color:${statusTextColorFor(status)}">${escapeHtml(status)}</span>`;
  }
  return `<span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>`;
}

function statusChipClass(status) {
  return statusColorFor(status) ? '' : statusBadgeClass(status);
}

function statusChipStyle(status) {
  const color = statusColorFor(status);
  return color ? `background:${color};color:${statusTextColorFor(status)};` : '';
}

function formatDateOnly(str) {
  if (!str) return '';
  const s = String(str);
  const idx = s.indexOf('T');
  return idx !== -1 ? s.slice(0, idx) : s;
}

let statusOptionsCache = null;

async function getStatusOptions() {
  if (statusOptionsCache) return statusOptionsCache;
  const result = await callApi('listStatus', {});
  if (result.ok) statusOptionsCache = result.items;
  return statusOptionsCache || [];
}

function invalidateStatusCache() {
  statusOptionsCache = null;
}

function statusColorFor(status) {
  if (!statusOptionsCache) return '';
  const found = statusOptionsCache.find((s) => s.name === status);
  return (found && found.color) || '';
}

function statusTextColorFor(status) {
  if (statusOptionsCache) {
    const found = statusOptionsCache.find((s) => s.name === status);
    if (found && found.textColor) return found.textColor;
  }
  return textColorForBg(statusColorFor(status));
}

function textColorForBg(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length !== 6) return '#1a1d23';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1a1d23' : '#ffffff';
}

// 로딩 스켈레톤: 'rows'는 표/목록 모양, 'stats'는 대시보드 숫자 칸 모양
function loadingScreen(label, variant) {
  const bar = (w, cls) => `<span class="skel ${cls || ''}" style="width:${w}%"></span>`;
  const body = variant === 'stats'
    ? [3, 3, 5].map((cells) => `
        <div class="skel-section">
          ${bar(14, 'skel-label')}
          <div class="skel-stats">${Array.from({ length: cells }, () => `<div class="skel-stat">${bar(40)}${bar(28, 'skel-num')}</div>`).join('')}</div>
        </div>`).join('')
    : `<div class="skel-rows">${[72, 58, 66, 50, 62, 54].map((w) => `
        <div class="skel-row">${bar(6)}${bar(w * 0.35)}${bar(w * 0.4)}${bar(12)}</div>`).join('')}</div>`;
  return `
    <div class="skeleton" role="status" aria-live="polite">
      <span class="sr-only">${escapeHtml(label || '데이터를 불러오고 있어요')}</span>
      ${body}
    </div>`;
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
