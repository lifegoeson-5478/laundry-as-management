async function renderDashboardTab(container) {
  const cachedHtml = sessionStorage.getItem('tabHtml_dashboard');
  container.innerHTML = cachedHtml || loadingScreen('대시보드 현황을 불러오고 있어요', 'stats');
  const [result] = await Promise.all([callApi('dashboard', {}), getStatusOptions()]);
  if (activeTab !== 'dashboard') return;
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

  // 어드민 상태값 순서대로 (목록에 없는 상태는 뒤로)
  const statusOrder = (statusOptionsCache || []).map((s) => s.name);
  const orderOf = (name) => { const i = statusOrder.indexOf(name); return i === -1 ? statusOrder.length : i; };

  // 고객분류별 상태 현황: 행 = 상태(색은 점에만), 칸 = 고객분류 + 합계, 숫자 아래 얇은 비율선
  const customerTypes = ['런드리고', '런드리24'];
  const byType = result.statusByCustomerType || {};
  const countOf = (type, status) => (byType[type] && byType[type][status]) || 0;
  const typeTotals = customerTypes.map((type) => Object.values(byType[type] || {}).reduce((a, b) => a + b, 0));
  const statuses = [...new Set(customerTypes.flatMap((type) => Object.keys(byType[type] || {})))]
    .filter((status) => customerTypes.some((type) => countOf(type, status) > 0))
    .sort((a, b) => orderOf(a) - orderOf(b));
  const countCell = (count, total) => `
    <td class="num-cell"><b>${count}</b><span class="ratio-line"><i style="width:${total ? (count / total) * 100 : 0}%"></i></span></td>`;
  const statusRows = statuses.map((status) => {
    const counts = customerTypes.map((type) => countOf(type, status));
    const sum = counts.reduce((a, b) => a + b, 0);
    return `
      <tr>
        <td><span class="status-dot" style="background:${statusColorFor(status) || '#9aa0ad'}"></span>${escapeHtml(status)}</td>
        ${counts.map((count, i) => countCell(count, typeTotals[i])).join('')}
        ${countCell(sum, typeTotals[0] + typeTotals[1])}
      </tr>`;
  }).join('') || `<tr><td colspan="${customerTypes.length + 2}">진행중인 건이 없습니다.</td></tr>`;

  container.innerHTML = `
    <h2>전체 현황</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">전체 접수 건수</div><div class="stat-value">${result.totalCount}</div></div>
      <div class="stat-card"><div class="stat-label">진행중</div><div class="stat-value">${result.totalOpen}</div></div>
      <div class="stat-card"><div class="stat-label">완료</div><div class="stat-value">${result.totalClosed}</div></div>
    </div>

    <h2>AS 접수 · 진행 · 회수 현황</h2>
    <div class="stat-grid">
      <div class="stat-card clickable" id="need-intake-card">
        <div class="stat-label">AS 접수 필요</div>
        <div class="stat-value">${result.needIntake}</div>
      </div>
      <div class="stat-card clickable" id="in-progress-card">
        <div class="stat-label">AS 진행중</div>
        <div class="stat-value">${(result.byStatus && result.byStatus['AS 진행중']) || 0}</div>
      </div>
      <div class="stat-card clickable" id="need-pickup-card">
        <div class="stat-label">AS 회수 필요</div>
        <div class="stat-value">${result.needPickup}</div>
      </div>
    </div>

    <h2>경과기간별 수량</h2>
    <div class="stat-grid">${agingCards}</div>

    <h2>고객분류별 상태 현황</h2>
    <div class="matrix-scroll">
      <table class="list-table status-matrix">
        <thead><tr>
          <th>상태</th>
          ${customerTypes.map((type, i) => `<th>${escapeHtml(type)} <span>${typeTotals[i]}</span></th>`).join('')}
          <th>합계 <span>${typeTotals[0] + typeTotals[1]}</span></th>
        </tr></thead>
        <tbody>${statusRows}</tbody>
      </table>
    </div>

    <h2>담당자별 진행 현황</h2>
    <table class="list-table staff-table">
      <thead><tr><th>담당자</th><th>진행중 건수</th></tr></thead>
      <tbody>${staffRows}</tbody>
    </table>
  `;

  document.getElementById('need-intake-card').addEventListener('click', () => {
    showTab('field', { section: '접수 필요' });
  });
  document.getElementById('in-progress-card').addEventListener('click', () => {
    showTab('field', { section: 'AS 진행중' });
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

  sessionStorage.setItem('tabHtml_dashboard', container.innerHTML);
}
