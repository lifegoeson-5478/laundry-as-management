function ensureStackTooltip_() {
  let el = document.getElementById('stack-tooltip-portal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stack-tooltip-portal';
    el.className = 'stack-tooltip';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function showStackTooltip_(segment) {
  const tooltip = ensureStackTooltip_();
  tooltip.innerHTML = `
    <div class="stack-tooltip-title">${escapeHtml(segment.dataset.name)}</div>
    <div class="stack-tooltip-value">진행중 ${escapeHtml(segment.dataset.count)}건</div>
  `;
  const rect = segment.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
  tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
  tooltip.hidden = false;
}

function hideStackTooltip_() {
  const tooltip = document.getElementById('stack-tooltip-portal');
  if (tooltip) tooltip.hidden = true;
}

async function renderDashboardTab(container) {
  container.innerHTML = loadingScreen('대시보드 현황을 불러오고 있어요');
  const [result] = await Promise.all([callApi('dashboard', {}), getStatusOptions()]);
  if (!result.ok) {
    container.innerHTML = `<div>대시보드를 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const agingCards = Object.entries(result.agingBuckets).map(([bucket, count]) => `
    <div class="stat-card clickable" data-nav="aging" data-bucket="${escapeHtml(bucket)}">
      <div class="stat-label">${escapeHtml(bucket)}</div>
      <div class="stat-value">${count}</div>
    </div>
  `).join('');

  const staffRows = Object.entries(result.byStaff).map(([name, count]) => `
    <tr class="clickable-row" data-staff="${escapeHtml(name)}"><td data-label="담당자">${escapeHtml(name)}</td><td data-label="진행중 건수">${count}</td></tr>
  `).join('') || '<tr><td colspan="2">진행중인 건이 없습니다.</td></tr>';

  const statusEntries = Object.entries(result.byStatus || {}).filter(([, count]) => count > 0);
  const totalStatusCount = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const stackedSegments = statusEntries.map(([name, count]) => {
    const color = statusColorFor(name) || '#9aa0ad';
    const pct = totalStatusCount ? (count / totalStatusCount) * 100 : 0;
    return `<div class="stacked-bar-segment" style="width:${pct}%;background:${color}" data-name="${escapeHtml(name)}" data-count="${count}"></div>`;
  }).join('');
  const legendItems = statusEntries.map(([name, count]) => {
    const color = statusColorFor(name) || '#9aa0ad';
    return `
      <div class="stacked-legend-item">
        <span class="stacked-legend-dot" style="background:${color}"></span>${escapeHtml(name)} <strong>${count}</strong>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h2>전체 현황</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">전체 접수 건수</div><div class="stat-value">${result.totalCount}</div></div>
      <div class="stat-card"><div class="stat-label">진행중</div><div class="stat-value">${result.totalOpen}</div></div>
      <div class="stat-card"><div class="stat-label">완료</div><div class="stat-value">${result.totalClosed}</div></div>
    </div>

    <h2>AS 접수 · 회수 필요 현황</h2>
    <div class="stat-grid">
      <div class="stat-card clickable" id="need-intake-card">
        <div class="stat-label">AS 접수 필요</div>
        <div class="stat-value">${result.needIntake}</div>
      </div>
      <div class="stat-card clickable" id="need-pickup-card">
        <div class="stat-label">AS 회수 필요</div>
        <div class="stat-value">${result.needPickup}</div>
      </div>
    </div>

    <h2>경과기간별 수량</h2>
    <div class="stat-grid">${agingCards}</div>

    <h2>상태별 현황 (진행중 총 ${totalStatusCount}건)</h2>
    <div class="stacked-bar">${stackedSegments || '<div class="stacked-bar-segment empty" style="width:100%"></div>'}</div>
    <div class="stacked-legend">${legendItems || '<div class="field-empty">진행중인 건이 없습니다.</div>'}</div>

    <h2>담당자별 진행 현황</h2>
    <table class="list-table staff-table">
      <thead><tr><th>담당자</th><th>진행중 건수</th></tr></thead>
      <tbody>${staffRows}</tbody>
    </table>
  `;

  document.getElementById('need-intake-card').addEventListener('click', () => {
    showTab('field', { section: '접수 필요' });
  });
  document.getElementById('need-pickup-card').addEventListener('click', () => {
    showTab('field', { section: '회수 필요' });
  });

  container.querySelectorAll('[data-nav="aging"]').forEach((card) => {
    card.addEventListener('click', () => {
      showTab('list', { agingBucket: card.dataset.bucket });
    });
  });

  container.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => {
      showTab('list', { staff: row.dataset.staff });
    });
  });

  container.querySelectorAll('.stacked-bar-segment:not(.empty)').forEach((segment) => {
    segment.addEventListener('mouseenter', () => showStackTooltip_(segment));
    segment.addEventListener('mouseleave', hideStackTooltip_);
  });
}
