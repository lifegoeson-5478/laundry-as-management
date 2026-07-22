async function renderDashboardTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';
  const result = await callApi('dashboard', {});
  if (!result.ok) {
    container.innerHTML = `<div>대시보드를 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const agingRows = Object.entries(result.agingBuckets).map(([bucket, count]) =>
    `<tr><td>${escapeHtml(bucket)}</td><td>${count}</td></tr>`
  ).join('');

  const staffRows = Object.entries(result.byStaff).map(([name, count]) =>
    `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`
  ).join('');

  container.innerHTML = `
    <h2>AS 접수/회수 필요 현황</h2>
    <table>
      <tr><td>AS 접수 필요 수량</td><td>${result.needIntake}</td></tr>
      <tr><td>AS 회수 필요 수량</td><td>${result.needPickup}</td></tr>
    </table>
    <h2>경과기간별 수량</h2>
    <table>${agingRows}</table>
    <h2>담당자별 진행 현황</h2>
    <table>${staffRows}</table>
  `;
}
