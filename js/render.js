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
    return `<span class="badge" style="background:${color};color:${textColorForBg(color)}">${escapeHtml(status)}</span>`;
  }
  return `<span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>`;
}

function statusChipClass(status) {
  return statusColorFor(status) ? '' : statusBadgeClass(status);
}

function statusChipStyle(status) {
  const color = statusColorFor(status);
  return color ? `background:${color};color:${textColorForBg(color)};` : '';
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

function textColorForBg(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length !== 6) return '#1a1d23';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1a1d23' : '#ffffff';
}

function loadingScreen(subtitle) {
  return `
    <div class="loading-state">
      <div class="loading-illust">
        <div class="loading-illust-glow"></div>
        <div class="loading-illust-card">
          <div class="loading-illust-bar"></div>
          <div class="loading-illust-line"></div>
          <div class="loading-illust-line short"></div>
        </div>
        <div class="loading-illust-ring"></div>
      </div>
      <h3>잠시만 기다려 주세요</h3>
      <p>${escapeHtml(subtitle || '데이터를 불러오고 있어요')}</p>
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
