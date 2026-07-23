async function renderDashboardTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';
  const result = await callApi('dashboard', {});
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

  const maxCustomerCount = Math.max(1, ...Object.values(result.byCustomerType));
  const customerBars = Object.entries(result.byCustomerType).map(([type, count]) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(type)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / maxCustomerCount) * 100}%"></div></div>
      <div class="bar-value">${count}</div>
    </div>
  `).join('') || '<div>데이터가 없습니다.</div>';

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

    <h2>고객분류별 현황</h2>
    <div class="bar-chart">${customerBars}</div>

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
}
