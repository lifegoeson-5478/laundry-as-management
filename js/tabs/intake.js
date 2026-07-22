const INTAKE_FIELDS = [
  ['고객분류', 'select', ['런드리고', '런드리24']],
  ['회원카드', 'text'],
  ['회원연락처', 'text'],
  ['수거요청일자', 'date'],
  ['바코드번호', 'text'],
  ['브랜드', 'text'],
  ['품목', 'text'],
  ['품번', 'text'],
  ['생산연도', 'text'],
  ['사이즈', 'text'],
  ['색상', 'text'],
  ['매장위치', 'text'],
  ['브랜드AS동의일', 'date'],
  ['손상부위', 'text'],
  ['요청건관련메모', 'textarea']
];

function renderIntakeTab(container) {
  const fieldsHtml = INTAKE_FIELDS.map(([name, type, options]) => {
    if (type === 'select') {
      const optionsHtml = options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
      return `<label>${name}<select name="${name}">${optionsHtml}</select></label>`;
    }
    if (type === 'textarea') {
      return `<label>${name}<textarea name="${name}"></textarea></label>`;
    }
    return `<label>${name}<input type="${type}" name="${name}"></label>`;
  }).join('');

  container.innerHTML = `
    <form id="intake-form">
      ${fieldsHtml}
      <div id="delivery-done-field" style="display:none;">
        <label>런드리고) 배송 완료 처리
          <select name="런드리고배송완료처리">
            <option value="">선택하세요</option>
            <option value="네 완료 했습니다.">네 완료 했습니다.</option>
            <option value="런드리24">런드리24</option>
          </select>
        </label>
      </div>
      <button type="submit">제출</button>
    </form>
  `;

  const form = document.getElementById('intake-form');
  const customerTypeSelect = form.querySelector('[name="고객분류"]');

  function syncDeliveryDoneField() {
    document.getElementById('delivery-done-field').style.display =
      customerTypeSelect.value === '런드리고' ? 'block' : 'none';
  }

  customerTypeSelect.addEventListener('change', syncDeliveryDoneField);
  syncDeliveryDoneField();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const record = {};
    formData.forEach((value, key) => { record[key] = value; });

    const result = await callApi('submitAS', { form: record });
    if (result.ok) {
      alert('접수되었습니다.');
      form.reset();
      document.getElementById('delivery-done-field').style.display = 'none';
    } else {
      alert('접수 실패: ' + result.error);
    }
  });
}
