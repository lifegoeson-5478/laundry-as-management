const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLogic() {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'apps-script', 'Logic.gs'),
    'utf8'
  );
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

test('computeAgingBucket: 오늘 접수는 2주 이하', () => {
  const { computeAgingBucket } = loadLogic();
  const today = new Date('2026-07-22');
  assert.strictEqual(computeAgingBucket('2026-07-20', today), '2주 이하');
});

test('computeAgingBucket: 정확히 3주 전은 3주 이상', () => {
  const { computeAgingBucket } = loadLogic();
  const today = new Date('2026-07-22');
  assert.strictEqual(computeAgingBucket('2026-07-01', today), '3주 이상');
});

test('computeAgingBucket: 5주 초과', () => {
  const { computeAgingBucket } = loadLogic();
  const today = new Date('2026-07-22');
  assert.strictEqual(computeAgingBucket('2026-05-01', today), '5주 초과');
});

test('FIELD_STATUS_MAP 매핑 확인', () => {
  const { FIELD_STATUS_MAP } = loadLogic();
  assert.strictEqual(FIELD_STATUS_MAP['AS불가'], 'AS 불가');
  assert.strictEqual(FIELD_STATUS_MAP['진행중'], 'AS 진행중');
  assert.strictEqual(FIELD_STATUS_MAP['수거완료'], '회수 완료');
});

test('rowToObject / objectToRow 왕복 변환', () => {
  const { rowToObject, objectToRow } = loadLogic();
  const headers = ['id', '브랜드', '상태'];
  const row = ['1', '나이키', '접수 필요'];
  const obj = rowToObject(headers, row);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(obj)), { id: '1', 브랜드: '나이키', 상태: '접수 필요' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(objectToRow(headers, obj))), row);
});
