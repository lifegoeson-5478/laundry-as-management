async function renderDashboardTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';
  const result = await callApi('dashboard', {});
  if (!result.ok) {
    container.innerHTML = `<div>대시보드를 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const agingCards = Object.entries(result.agingBuckets).map(([bucket, count]) => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(bucket)}</div>
      <div class="stat-value">${count}</div>
    </div>
  `).join('');

  const staffRows = Object.entries(result.byStaff).map(([name, count]) =>
    `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`
  ).join('') || '<tr><td colspan="2">진행중인 건이 없습니다.</td></tr>';

  container.innerHTML = `
    <h2>AS 접수 · 회수 필요 현황</h2>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">AS 접수 필요</div>
        <div class="stat-value">${result.needIntake}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">AS 회수 필요</div>
        <div class="stat-value">${result.needPickup}</div>
      </div>
    </div>

    <h2>경과기간별 수량</h2>
    <div class="stat-grid">${agingCards}</div>

    <h2>담당자별 진행 현황</h2>
    <table class="list-table">
      <thead><tr><th>담당자</th><th>진행중 건수</th></tr></thead>
      <tbody>${staffRows}</tbody>
    </table>
  `;
}
