function renderIntakeTab(container) {
  container.innerHTML = `
    <form id="intake-form">
      <div class="wizard-step">
        <div class="step-head"><span class="step-num">1</span>고객 정보</div>
        <div class="chip-group" data-field="고객분류">
          <button type="button" class="chip active" data-value="런드리고">런드리고</button>
          <button type="button" class="chip" data-value="런드리24">런드리24</button>
        </div>
        <input type="hidden" name="고객분류" value="런드리고">
        <div class="field-grid">
          <label>회원카드<input type="text" name="회원카드"></label>
          <label>회원연락처<input type="text" name="회원연락처"></label>
        </div>
        <div id="delivery-done-field">
          <label>배송 완료 처리</label>
          <div class="chip-group" data-field="런드리고배송완료처리">
            <button type="button" class="chip" data-value="네 완료 했습니다.">네 완료 했습니다.</button>
          </div>
          <input type="hidden" name="런드리고배송완료처리" value="">
        </div>
      </div>

      <div class="wizard-step">
        <div class="step-head"><span class="step-num">2</span>세탁물 정보</div>
        <div class="field-grid">
          <label>브랜드<input type="text" name="브랜드"></label>
          <label>품목<input type="text" name="품목"></label>
          <label>품번<input type="text" name="품번"></label>
          <label>생산연도<input type="text" name="생산연도"></label>
          <label>사이즈<input type="text" name="사이즈"></label>
          <label>색상<input type="text" name="색상"></label>
          <label>바코드번호<input type="text" name="바코드번호"></label>
          <label>수거요청일자<input type="date" name="수거요청일자"></label>
        </div>
        <label>손상부위<textarea name="손상부위"></textarea></label>
      </div>

      <div class="wizard-step">
        <div class="step-head"><span class="step-num">3</span>접수 처리 정보</div>
        <div class="field-grid">
          <label>매장위치<input type="text" name="매장위치" placeholder="롯데 00층/뉴코아 00층"></label>
          <label>브랜드AS동의일<input type="date" name="브랜드AS동의일"></label>
        </div>
        <label>요청건관련메모<textarea name="요청건관련메모" placeholder="예: 출고전 꼭 확인 받고 출고 해주세요"></textarea></label>
      </div>

      <div class="wizard-actions">
        <button type="submit" class="btn-primary-block">접수하기</button>
        <button type="reset" class="btn-outline-block">초기화</button>
      </div>
    </form>
  `;

  const form = document.getElementById('intake-form');

  form.querySelectorAll('.chip-group').forEach((group) => {
    const fieldName = group.dataset.field;
    const hiddenInput = form.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    group.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        hiddenInput.value = chip.dataset.value;
        if (fieldName === '고객분류') syncDeliveryDoneField();
      });
    });
  });

  function syncDeliveryDoneField() {
    const customerType = form.querySelector('input[name="고객분류"]').value;
    document.getElementById('delivery-done-field').style.display =
      customerType === '런드리고' ? 'block' : 'none';
  }
  syncDeliveryDoneField();

  form.addEventListener('reset', () => {
    setTimeout(() => {
      form.querySelectorAll('.chip-group').forEach((group) => {
        const fieldName = group.dataset.field;
        const hiddenInput = form.querySelector(`input[type="hidden"][name="${fieldName}"]`);
        group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        if (fieldName === '고객분류') {
          group.querySelector('.chip').classList.add('active');
          hiddenInput.value = '런드리고';
        } else {
          hiddenInput.value = '';
        }
      });
      syncDeliveryDoneField();
    }, 0);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const record = {};
    formData.forEach((value, key) => { record[key] = value; });

    const result = await callApi('submitAS', { form: record });
    if (result.ok) {
      alert('접수되었습니다.');
      form.reset();
    } else {
      alert('접수 실패: ' + result.error);
    }
  });
}
