# 세탁 브랜드 AS 관리 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세탁 브랜드 AS 접수/현황 관리를 위한 웹앱을 만든다. 프론트는 정적 사이트(GitHub Pages), 백엔드는 Google Apps Script 웹앱, 데이터 저장소는 Google Sheets.

**Architecture:** 정적 HTML/JS 프론트엔드(탭 5개: 대시보드/접수/목록/현장/설정)가 Google Identity Services로 로그인한 뒤, Apps Script 웹앱에 `action` 기반 JSON POST 요청을 보낸다. Apps Script는 Google ID 토큰을 검증해 자체 서명 세션 토큰을 발급하고, 이후 요청은 이 세션 토큰으로 인증/권한(역할)을 검사한다. 데이터는 Google Sheets 3개 시트(`AS접수`, `직원목록`, `상태값`)에 저장한다.

**Tech Stack:** Vanilla HTML/CSS/JS (프론트), Google Apps Script V8 런타임 (백엔드), Google Sheets, Google Identity Services (로그인), Node.js (순수 로직 함수의 로컬 테스트용, 배포 대상 아님)

## Global Constraints

- 프로젝트 루트: `C:\Users\의식주컴퍼니\Desktop\클로드 코드\AS 관리 페이지\` (이하 모든 경로는 이 루트 기준)
- 스펙 문서: `docs/superpowers/specs/2026-07-22-laundry-as-management-design.md` — 모든 필드명/상태값/액션명은 이 문서와 정확히 일치해야 함
- 상태값 초기 17개: 접수 필요, 매장 접수 완료, 회수 필요, 회수 완료, 중동사 접수 진행, 중동사 접수 완료, 아토즈레더 접수 진행, 아토즈레더 접수 완료, 택배 접수 진행, 택배 접수 완료, 택배 수령 필요, 택배 수령 완료, 출고 완료, 보상 종결, 그외 추가 확인 필요, AS 불가, AS 진행중
- 현장 탭 3단계 매핑(하드코딩, 설정 가능하게 만들지 않음): AS불가→"AS 불가", 진행중→"AS 진행중", 수거완료→"회수 완료"
- 화면 문구/에러 메시지는 한국어로 작성
- 커밋은 작업 단위로 자주, 메시지는 한글이어도 영문이어도 무방하되 무엇을 했는지 명확히

---

## 파일 구조

```
AS 관리 페이지/
  docs/superpowers/specs/2026-07-22-laundry-as-management-design.md   (기존)
  docs/superpowers/plans/2026-07-22-laundry-as-management.md          (이 문서)
  apps-script/
    appsscript.json       # Apps Script 매니페스트
    Code.gs                # doGet/doPost 진입점, action 디스패처
    Sheets.gs               # 시트 범용 CRUD 헬퍼
    Auth.gs                 # 세션 토큰 발급/검증, login 액션
    AS.gs                   # submitAS/listAS/updateStatus/fieldUpdate
    Dashboard.gs             # dashboard 액션 (집계)
    Staff.gs                 # listStaff/addStaff/updateStaff
    Status.gs                # listStatus/addStatus/deleteStatus
    Logic.gs                 # 순수 함수 (경과기간 버킷, 현장상태 매핑, 행<->객체 변환) — Node에서도 그대로 로드해 테스트
    Setup.gs                 # 시트/헤더/초기 상태값 생성용 1회성 스크립트
  test/
    logic.test.js            # Logic.gs의 순수 함수에 대한 Node 테스트 (vm 모듈로 Logic.gs를 그대로 로드)
  index.html                 # 앱 셸 + 탭 네비게이션
  css/style.css
  js/
    config.js                # Apps Script 웹앱 URL, Google Client ID 등 설정값
    api.js                   # 백엔드 fetch 래퍼
    auth.js                  # GIS 로그인, 세션 localStorage 관리
    render.js                # escapeHtml 등 공용 DOM 헬퍼
    tabs/
      dashboard.js
      intake.js
      list.js
      field.js
      settings.js
    app.js                   # 탭 전환, 초기화 진입점
```

---

### Task 1: 프로젝트 스캐폴드 + Google Sheet 스키마 초기화 스크립트

**Files:**
- Create: `apps-script/Setup.gs`
- Create: `apps-script/appsscript.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: `AS접수`, `직원목록`, `상태값` 시트가 올바른 헤더로 존재한다는 전제. 이후 모든 태스크가 이 헤더 순서에 의존.

- [ ] **Step 1: git 저장소 초기화**

```bash
git init
```

- [ ] **Step 2: `.gitignore` 작성**

```
.clasp.json
node_modules/
```

- [ ] **Step 3: `apps-script/appsscript.json` 작성**

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  }
}
```

- [ ] **Step 4: `apps-script/Setup.gs` 작성**

```javascript
// Apps Script 편집기에서 이 함수를 한 번 수동 실행해 시트/헤더/초기 상태값을 만든다.
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var asHeaders = [
    'id', '접수일시', '접수자', '고객분류', '회원카드', '회원연락처',
    '수거요청일자', '바코드번호', '브랜드', '품목', '품번', '생산연도',
    '사이즈', '색상', '매장위치', '브랜드AS동의일', '손상부위',
    '요청건관련메모', '런드리고배송완료처리', '상태', '현장메모'
  ];
  createSheetIfMissing_(ss, 'AS접수', asHeaders);

  var staffHeaders = ['이메일', '이름', '역할', '활성여부'];
  createSheetIfMissing_(ss, '직원목록', staffHeaders);

  var statusHeaders = ['상태명', '정렬순서'];
  var statusSheet = createSheetIfMissing_(ss, '상태값', statusHeaders);
  var initialStatuses = [
    '접수 필요', '매장 접수 완료', '회수 필요', '회수 완료',
    '중동사 접수 진행', '중동사 접수 완료',
    '아토즈레더 접수 진행', '아토즈레더 접수 완료',
    '택배 접수 진행', '택배 접수 완료',
    '택배 수령 필요', '택배 수령 완료',
    '출고 완료', '보상 종결', '그외 추가 확인 필요',
    'AS 불가', 'AS 진행중'
  ];
  if (statusSheet.getLastRow() === 1) {
    initialStatuses.forEach(function (name, i) {
      statusSheet.appendRow([name, i + 1]);
    });
  }

  Logger.log('Setup complete');
}

function createSheetIfMissing_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}
```

- [ ] **Step 5: 커밋**

```bash
git add apps-script/appsscript.json apps-script/Setup.gs .gitignore
git commit -m "chore: project scaffold + sheet setup script"
```

**수동 확인 (Apps Script는 로컬 테스트 불가):** 이 파일을 Google Sheets에 연결된 Apps Script 프로젝트에 붙여넣고 `setupSpreadsheet` 함수를 편집기에서 직접 실행 → 실행 로그(Executions)에서 "Setup complete" 확인, 스프레드시트에 3개 시트가 헤더와 함께 생성됐는지 확인.

---

### Task 2: 순수 로직 함수 (`Logic.gs`) + Node 테스트

**Files:**
- Create: `apps-script/Logic.gs`
- Create: `test/logic.test.js`

**Interfaces:**
- Produces:
  - `computeAgingBucket(pickupDateStr, todayDate)` → `'2주 이하' | '3주 이상' | '4주 이상' | '5주 이상' | '5주 초과'`
  - `FIELD_STATUS_MAP` → `{ 'AS불가': 'AS 불가', '진행중': 'AS 진행중', '수거완료': '회수 완료' }`
  - `rowToObject(headers, row)` → `object`
  - `objectToRow(headers, obj)` → `array`
- Consumes: 없음 (순수 함수, 외부 의존성 없음)

- [ ] **Step 1: `test/logic.test.js` 작성 (실패하는 테스트부터)**

```javascript
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
  assert.deepStrictEqual(obj, { id: '1', 브랜드: '나이키', 상태: '접수 필요' });
  assert.deepStrictEqual(objectToRow(headers, obj), row);
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인 (Logic.gs가 없으므로 실패)**

Run: `node --test test/logic.test.js`
Expected: FAIL (ENOENT: `apps-script/Logic.gs` 없음)

- [ ] **Step 3: `apps-script/Logic.gs` 구현**

```javascript
// 순수 함수만 포함. SpreadsheetApp 등 Apps Script 전용 API를 사용하지 않는다.
// 이 파일은 Node의 vm 모듈로도 그대로 로드되므로 전역 함수/변수로만 정의한다.

var FIELD_STATUS_MAP = {
  'AS불가': 'AS 불가',
  '진행중': 'AS 진행중',
  '수거완료': '회수 완료'
};

function computeAgingBucket(pickupDateStr, todayDate) {
  var pickup = new Date(pickupDateStr);
  var today = todayDate || new Date();
  var msPerDay = 24 * 60 * 60 * 1000;
  var daysElapsed = Math.floor((today.getTime() - pickup.getTime()) / msPerDay);
  var weeksElapsed = daysElapsed / 7;

  if (weeksElapsed <= 2) return '2주 이하';
  if (weeksElapsed <= 3) return '3주 이상';
  if (weeksElapsed <= 4) return '4주 이상';
  if (weeksElapsed <= 5) return '5주 이상';
  return '5주 초과';
}

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function (header, i) {
    obj[header] = row[i];
  });
  return obj;
}

function objectToRow(headers, obj) {
  return headers.map(function (header) {
    return obj[header] !== undefined ? obj[header] : '';
  });
}
```

- [ ] **Step 4: 테스트 재실행해서 통과 확인**

Run: `node --test test/logic.test.js`
Expected: PASS (5개 테스트 모두 통과)

- [ ] **Step 5: 커밋**

```bash
git add apps-script/Logic.gs test/logic.test.js
git commit -m "feat: pure logic functions with node tests"
```

---

### Task 3: Apps Script 핵심부 — `Sheets.gs` (시트 CRUD), `Auth.gs` (세션 토큰), `Code.gs` (디스패처 + login 액션)

**Files:**
- Create: `apps-script/Sheets.gs`
- Create: `apps-script/Auth.gs`
- Create: `apps-script/Code.gs`

**Interfaces:**
- Consumes: `rowToObject`, `objectToRow` (Task 2, `Logic.gs`)
- Produces:
  - `getAllRows(sheetName)` → `Array<Object>` (각 객체에 `_row` 프로퍼티로 실제 시트 행 번호 포함)
  - `appendRowObject(sheetName, obj)` → 없음 (부수효과: 시트에 행 추가)
  - `updateRowById(sheetName, id, updates)` → `boolean` (id로 못 찾으면 false)
  - `createSessionToken(email, name, role)` → `string`
  - `verifySessionToken(token)` → `{email, name, role} | null`
  - `jsonResponse(obj)` → `ContentService.TextOutput`
  - action 라우팅: `doPost(e)` 가 모든 액션의 진입점

- [ ] **Step 1: `apps-script/Sheets.gs` 작성**

```javascript
function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sheet;
}

function getAllRows(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject(headers, values[i]);
    obj._row = i + 1; // 1-based, 헤더 포함 실제 시트 행 번호
    rows.push(obj);
  }
  return rows;
}

function appendRowObject(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(objectToRow(headers, obj));
}

function updateRowById(sheetName, id, updates) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) {
      Object.keys(updates).forEach(function (key) {
        var col = headers.indexOf(key);
        if (col !== -1) {
          sheet.getRange(i + 1, col + 1).setValue(updates[key]);
        }
      });
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 2: `apps-script/Auth.gs` 작성**

```javascript
function getSessionSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function createSessionToken(email, name, role) {
  var payload = {
    email: email,
    name: name,
    role: role,
    exp: Date.now() + 8 * 60 * 60 * 1000 // 8시간
  };
  var payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadStr, getSessionSecret_())
  );
  return payloadStr + '.' + signature;
}

function verifySessionToken(token) {
  if (!token || token.indexOf('.') === -1) return null;
  var parts = token.split('.');
  var payloadStr = parts[0];
  var signature = parts[1];
  var expectedSignature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadStr, getSessionSecret_())
  );
  if (signature !== expectedSignature) return null;

  var payload = JSON.parse(Utilities.newBlob(
    Utilities.base64DecodeWebSafe(payloadStr)
  ).getDataAsString());

  if (payload.exp < Date.now()) return null;
  return payload;
}

function verifyGoogleIdToken_(idToken) {
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;
  var data = JSON.parse(response.getContentText());
  return data.email ? data : null;
}

function handleLogin_(payload) {
  var googleData = verifyGoogleIdToken_(payload.idToken);
  if (!googleData) {
    return { ok: false, error: '구글 로그인 검증에 실패했습니다.' };
  }
  var staff = getAllRows('직원목록').find(function (row) {
    return row.이메일 === googleData.email;
  });
  if (!staff || String(staff.활성여부).toLowerCase() !== 'true') {
    return { ok: false, error: '등록되지 않았거나 비활성화된 계정입니다. 관리자에게 문의하세요.' };
  }
  var token = createSessionToken(staff.이메일, staff.이름, staff.역할);
  return {
    ok: true,
    session: { email: staff.이메일, name: staff.이름, role: staff.역할, token: token }
  };
}
```

- [ ] **Step 3: `apps-script/Code.gs` 작성 (디스패처)**

```javascript
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireSession_(payload) {
  var session = verifySessionToken(payload.token);
  if (!session) throw new Error('로그인이 필요하거나 세션이 만료되었습니다.');
  return session;
}

function requireAdmin_(payload) {
  var session = requireSession_(payload);
  if (session.role !== '관리자') throw new Error('관리자만 사용할 수 있는 기능입니다.');
  return session;
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: '잘못된 요청 형식입니다.' });
  }

  var action = body.action;
  var payload = body.payload || {};

  try {
    switch (action) {
      case 'login':
        return jsonResponse(handleLogin_(payload));
      default:
        return jsonResponse({ ok: false, error: '알 수 없는 action입니다: ' + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add apps-script/Sheets.gs apps-script/Auth.gs apps-script/Code.gs
git commit -m "feat: apps script core - sheet CRUD, session auth, login action"
```

**수동 확인:** Apps Script 편집기에서 웹앱으로 배포(Task 8에서 정식 진행) 전, 편집기 안에서 임시 테스트 함수를 만들어 `handleLogin_({idToken: '가짜값'})` 호출 시 `ok:false`가 반환되는지 확인 (`verifyGoogleIdToken_`이 실패 응답을 던지므로).

---

### Task 4: `AS.gs` — submitAS, listAS

**Files:**
- Create: `apps-script/AS.gs`
- Modify: `apps-script/Code.gs:doPost` 의 `switch` 문에 케이스 추가

**Interfaces:**
- Consumes: `requireSession_`, `getAllRows`, `appendRowObject` (Task 3), `getAllRows('상태값')`
- Produces: `handleSubmitAS_(payload)`, `handleListAS_(payload)`

- [ ] **Step 1: `apps-script/AS.gs` 작성**

```javascript
var AS_REQUIRED_FIELDS = [
  '고객분류', '회원카드', '회원연락처', '수거요청일자', '바코드번호',
  '브랜드', '품목', '품번', '생산연도', '사이즈', '색상',
  '매장위치', '브랜드AS동의일', '손상부위'
];

function handleSubmitAS_(payload) {
  var session = requireSession_(payload);
  var form = payload.form || {};

  var missing = AS_REQUIRED_FIELDS.filter(function (field) {
    return !form[field];
  });
  if (missing.length > 0) {
    return { ok: false, error: '필수 항목이 비어있습니다: ' + missing.join(', ') };
  }

  var record = {
    id: Utilities.getUuid(),
    접수일시: new Date().toISOString(),
    접수자: session.name,
    고객분류: form.고객분류,
    회원카드: form.회원카드,
    회원연락처: form.회원연락처,
    수거요청일자: form.수거요청일자,
    바코드번호: form.바코드번호,
    브랜드: form.브랜드,
    품목: form.품목,
    품번: form.품번,
    생산연도: form.생산연도,
    사이즈: form.사이즈,
    색상: form.색상,
    매장위치: form.매장위치,
    브랜드AS동의일: form.브랜드AS동의일,
    손상부위: form.손상부위,
    요청건관련메모: form.요청건관련메모 || '',
    런드리고배송완료처리: form.고객분류 === '런드리고' ? (form.런드리고배송완료처리 || '') : '',
    상태: '접수 필요',
    현장메모: ''
  };

  appendRowObject('AS접수', record);
  return { ok: true, record: record };
}

function handleListAS_(payload) {
  requireSession_(payload);
  var rows = getAllRows('AS접수');
  rows.sort(function (a, b) {
    return new Date(b.접수일시) - new Date(a.접수일시);
  });
  return { ok: true, items: rows };
}
```

- [ ] **Step 2: `apps-script/Code.gs`의 `switch`에 케이스 추가**

```javascript
      case 'login':
        return jsonResponse(handleLogin_(payload));
      case 'submitAS':
        return jsonResponse(handleSubmitAS_(payload));
      case 'listAS':
        return jsonResponse(handleListAS_(payload));
      default:
```

- [ ] **Step 3: 커밋**

```bash
git add apps-script/AS.gs apps-script/Code.gs
git commit -m "feat: submitAS and listAS actions"
```

**수동 확인:** Task 8에서 웹앱 배포 후 curl로 `{"action":"submitAS", ...}` 요청을 보내 시트에 행이 추가되는지, `listAS`로 조회되는지 확인.

---

### Task 5: `AS.gs` — updateStatus, fieldUpdate

**Files:**
- Modify: `apps-script/AS.gs` (함수 추가)
- Modify: `apps-script/Code.gs:doPost` 의 `switch` 문에 케이스 추가

**Interfaces:**
- Consumes: `FIELD_STATUS_MAP` (Task 2, `Logic.gs`), `updateRowById` (Task 3)
- Produces: `handleUpdateStatus_(payload)`, `handleFieldUpdate_(payload)`

- [ ] **Step 1: `apps-script/AS.gs`에 함수 추가**

```javascript
function handleUpdateStatus_(payload) {
  requireSession_(payload);
  if (!payload.id || !payload.status) {
    return { ok: false, error: 'id와 status가 필요합니다.' };
  }
  var updated = updateRowById('AS접수', payload.id, { 상태: payload.status });
  if (!updated) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

function handleFieldUpdate_(payload) {
  requireSession_(payload);
  if (!payload.id || !payload.fieldStatus) {
    return { ok: false, error: 'id와 fieldStatus가 필요합니다.' };
  }
  var mappedStatus = FIELD_STATUS_MAP[payload.fieldStatus];
  if (!mappedStatus) {
    return { ok: false, error: '알 수 없는 현장 상태입니다: ' + payload.fieldStatus };
  }
  var updated = updateRowById('AS접수', payload.id, {
    상태: mappedStatus,
    현장메모: payload.memo || ''
  });
  if (!updated) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}
```

- [ ] **Step 2: `apps-script/Code.gs`의 `switch`에 케이스 추가**

```javascript
      case 'updateStatus':
        return jsonResponse(handleUpdateStatus_(payload));
      case 'fieldUpdate':
        return jsonResponse(handleFieldUpdate_(payload));
      default:
```

- [ ] **Step 3: 커밋**

```bash
git add apps-script/AS.gs apps-script/Code.gs
git commit -m "feat: updateStatus and fieldUpdate actions"
```

---

### Task 6: `Dashboard.gs` — 집계 액션

**Files:**
- Create: `apps-script/Dashboard.gs`
- Modify: `apps-script/Code.gs:doPost`

**Interfaces:**
- Consumes: `computeAgingBucket` (Task 2), `getAllRows` (Task 3)
- Produces: `handleDashboard_(payload)` → `{ok, needIntake, needPickup, agingBuckets, byStaff}`

- [ ] **Step 1: `apps-script/Dashboard.gs` 작성**

```javascript
function handleDashboard_(payload) {
  requireSession_(payload);
  var rows = getAllRows('AS접수');
  var today = new Date();

  var needIntake = rows.filter(function (r) { return r.상태 === '접수 필요'; }).length;
  var needPickup = rows.filter(function (r) { return r.상태 === '회수 필요'; }).length;

  var agingBuckets = { '2주 이하': 0, '3주 이상': 0, '4주 이상': 0, '5주 이상': 0, '5주 초과': 0 };
  var openRows = rows.filter(function (r) {
    return r.상태 !== '출고 완료' && r.상태 !== '보상 종결';
  });
  openRows.forEach(function (r) {
    if (!r.수거요청일자) return;
    var bucket = computeAgingBucket(r.수거요청일자, today);
    agingBuckets[bucket]++;
  });

  var byStaff = {};
  openRows.forEach(function (r) {
    var name = r.접수자 || '(미상)';
    byStaff[name] = (byStaff[name] || 0) + 1;
  });

  return {
    ok: true,
    needIntake: needIntake,
    needPickup: needPickup,
    agingBuckets: agingBuckets,
    byStaff: byStaff
  };
}
```

- [ ] **Step 2: `apps-script/Code.gs`의 `switch`에 케이스 추가**

```javascript
      case 'dashboard':
        return jsonResponse(handleDashboard_(payload));
      default:
```

- [ ] **Step 3: 커밋**

```bash
git add apps-script/Dashboard.gs apps-script/Code.gs
git commit -m "feat: dashboard aggregation action"
```

---

### Task 7: `Staff.gs`, `Status.gs` — 관리자 전용 액션

**Files:**
- Create: `apps-script/Staff.gs`
- Create: `apps-script/Status.gs`
- Modify: `apps-script/Code.gs:doPost`

**Interfaces:**
- Consumes: `requireAdmin_` (Task 3), `getAllRows`, `appendRowObject`, `updateRowById` (Task 3)
- Produces: `handleListStaff_`, `handleAddStaff_`, `handleUpdateStaff_`, `handleListStatus_`, `handleAddStatus_`, `handleDeleteStatus_`

- [ ] **Step 1: `apps-script/Staff.gs` 작성**

```javascript
function handleListStaff_(payload) {
  requireAdmin_(payload);
  return { ok: true, items: getAllRows('직원목록') };
}

function handleAddStaff_(payload) {
  requireAdmin_(payload);
  var form = payload.form || {};
  if (!form.이메일 || !form.이름) {
    return { ok: false, error: '이메일과 이름은 필수입니다.' };
  }
  var exists = getAllRows('직원목록').some(function (r) { return r.이메일 === form.이메일; });
  if (exists) return { ok: false, error: '이미 등록된 이메일입니다.' };

  appendRowObject('직원목록', {
    이메일: form.이메일,
    이름: form.이름,
    역할: form.역할 === '관리자' ? '관리자' : '일반',
    활성여부: true
  });
  return { ok: true };
}

function handleUpdateStaff_(payload) {
  requireAdmin_(payload);
  if (!payload.email) return { ok: false, error: 'email이 필요합니다.' };

  var sheet = getSheet_('직원목록');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailCol = headers.indexOf('이메일');
  for (var i = 1; i < values.length; i++) {
    if (values[i][emailCol] === payload.email) {
      Object.keys(payload.updates || {}).forEach(function (key) {
        var col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(payload.updates[key]);
      });
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 이메일을 찾을 수 없습니다.' };
}
```

- [ ] **Step 2: `apps-script/Status.gs` 작성**

```javascript
function handleListStatus_(payload) {
  requireSession_(payload);
  var rows = getAllRows('상태값');
  rows.sort(function (a, b) { return a.정렬순서 - b.정렬순서; });
  return { ok: true, items: rows.map(function (r) { return r.상태명; }) };
}

function handleAddStatus_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var rows = getAllRows('상태값');
  if (rows.some(function (r) { return r.상태명 === name; })) {
    return { ok: false, error: '이미 존재하는 상태값입니다.' };
  }
  var maxOrder = rows.reduce(function (max, r) { return Math.max(max, r.정렬순서 || 0); }, 0);
  appendRowObject('상태값', { 상태명: name, 정렬순서: maxOrder + 1 });
  return { ok: true };
}

function handleDeleteStatus_(payload) {
  requireAdmin_(payload);
  var name = payload.name;
  if (!name) return { ok: false, error: 'name이 필요합니다.' };

  var sheet = getSheet_('상태값');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var nameCol = headers.indexOf('상태명');
  for (var i = 1; i < values.length; i++) {
    if (values[i][nameCol] === name) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: '해당 상태값을 찾을 수 없습니다.' };
}
```

- [ ] **Step 3: `apps-script/Code.gs`의 `switch`에 케이스 추가**

```javascript
      case 'listStaff':
        return jsonResponse(handleListStaff_(payload));
      case 'addStaff':
        return jsonResponse(handleAddStaff_(payload));
      case 'updateStaff':
        return jsonResponse(handleUpdateStaff_(payload));
      case 'listStatus':
        return jsonResponse(handleListStatus_(payload));
      case 'addStatus':
        return jsonResponse(handleAddStatus_(payload));
      case 'deleteStatus':
        return jsonResponse(handleDeleteStatus_(payload));
      default:
```

- [ ] **Step 4: 커밋**

```bash
git add apps-script/Staff.gs apps-script/Status.gs apps-script/Code.gs
git commit -m "feat: staff and status admin actions"
```

---

### Task 8: Apps Script 웹앱 배포

**Files:** 없음 (Google 설정 작업)

- [ ] **Step 1:** Google Sheets 새 파일 생성 → 확장 프로그램 > Apps Script 열기
- [ ] **Step 2:** Task 1~7에서 만든 모든 `.gs` 파일 내용을 각각 같은 이름의 파일로 편집기에 생성/붙여넣기, `appsscript.json`은 편집기의 프로젝트 설정에서 매니페스트 보기를 켠 뒤 반영
- [ ] **Step 3:** `setupSpreadsheet` 함수 실행 (Task 1 수동 확인과 동일)
- [ ] **Step 4:** 배포 > 새 배포 > 유형: 웹앱, 실행 계정: 나, 액세스 권한: 전체 공개(익명 포함) 선택 후 배포, 웹앱 URL 확보
- [ ] **Step 5:** `직원목록` 시트에 최소 1명(본인)을 관리자로 수동 입력 (이메일, 이름, 역할=관리자, 활성여부=true) — 최초 관리자 부트스트랩용
- [ ] **Step 6:** curl로 login 액션 스모크 테스트 (실제 ID 토큰 없이 실패 응답 형식만 확인)

```bash
curl -X POST "<웹앱 URL>" -H "Content-Type: application/json" -d "{\"action\":\"login\",\"payload\":{\"idToken\":\"invalid\"}}"
```

Expected: `{"ok":false,"error":"구글 로그인 검증에 실패했습니다."}`

- [ ] **Step 7:** 웹앱 URL을 이후 Task 9의 `js/config.js`에 붙여넣을 수 있도록 기록해둔다

---

### Task 9: 프론트 기반 — `config.js`, `api.js`, `auth.js`, `render.js`, `index.html` 셸

**Files:**
- Create: `js/config.js`
- Create: `js/api.js`
- Create: `js/auth.js`
- Create: `js/render.js`
- Create: `js/app.js`
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Produces:
  - `API_URL`, `GOOGLE_CLIENT_ID` (전역 상수, `config.js`)
  - `callApi(action, payload)` → `Promise<object>` (`api.js`)
  - `getSession()` → `{email,name,role,token} | null`, `setSession(session)`, `clearSession()`, `initGoogleLogin(onSuccess)` (`auth.js`)
  - `escapeHtml(str)` → `string` (`render.js`)

- [ ] **Step 1: `js/config.js` 작성 (플레이스홀더는 Task 8 배포 후 실제 값으로 교체)**

```javascript
const API_URL = 'REPLACE_WITH_APPS_SCRIPT_WEB_APP_URL';
const GOOGLE_CLIENT_ID = 'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID';
```

- [ ] **Step 2: `js/render.js` 작성**

```javascript
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 3: `js/api.js` 작성**

```javascript
async function callApi(action, payload) {
  const session = getSession();
  const body = {
    action: action,
    payload: Object.assign({}, payload, { token: session ? session.token : null })
  };
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '서버와 통신할 수 없습니다. 네트워크를 확인해주세요.' };
  }
}
```

- [ ] **Step 4: `js/auth.js` 작성**

```javascript
const SESSION_KEY = 'as_session';

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (session.exp && session.exp < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch (err) {
    return null;
  }
}

function setSession(session) {
  const withExp = Object.assign({}, session, { exp: Date.now() + 8 * 60 * 60 * 1000 });
  localStorage.setItem(SESSION_KEY, JSON.stringify(withExp));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function initGoogleLogin(onSuccess) {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response) => {
      const result = await callApi('login', { idToken: response.credential });
      if (result.ok) {
        setSession(result.session);
        onSuccess(result.session);
      } else {
        alert(result.error || '로그인에 실패했습니다.');
      }
    }
  });
  google.accounts.id.renderButton(
    document.getElementById('google-login-button'),
    { theme: 'outline', size: 'large' }
  );
}
```

- [ ] **Step 5: `index.html` 작성 (탭 셸만, 각 탭 상세는 이후 태스크)**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>브랜드 AS 관리</title>
<link rel="stylesheet" href="css/style.css">
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>

<div id="login-screen">
  <h1>브랜드 AS 관리</h1>
  <div id="google-login-button"></div>
</div>

<div id="app" style="display:none;">
  <nav id="tab-nav">
    <button data-tab="dashboard">대시보드</button>
    <button data-tab="intake">접수</button>
    <button data-tab="list">목록</button>
    <button data-tab="field">현장</button>
    <button data-tab="settings" id="settings-tab-button" style="display:none;">설정</button>
    <button id="logout-button">로그아웃</button>
  </nav>
  <main id="tab-content"></main>
</div>

<script src="js/config.js"></script>
<script src="js/render.js"></script>
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script src="js/tabs/dashboard.js"></script>
<script src="js/tabs/intake.js"></script>
<script src="js/tabs/list.js"></script>
<script src="js/tabs/field.js"></script>
<script src="js/tabs/settings.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: `js/app.js` 작성**

```javascript
const TAB_RENDERERS = {
  dashboard: renderDashboardTab,
  intake: renderIntakeTab,
  list: renderListTab,
  field: renderFieldTab,
  settings: renderSettingsTab
};

function showTab(tabName) {
  document.getElementById('tab-content').innerHTML = '';
  TAB_RENDERERS[tabName](document.getElementById('tab-content'));
}

function startApp(session) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if (session.role === '관리자') {
    document.getElementById('settings-tab-button').style.display = 'inline-block';
  }
  document.querySelectorAll('#tab-nav button[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  document.getElementById('logout-button').addEventListener('click', () => {
    clearSession();
    location.reload();
  });
  showTab('dashboard');
}

window.addEventListener('DOMContentLoaded', () => {
  const existingSession = getSession();
  if (existingSession) {
    startApp(existingSession);
  } else {
    initGoogleLogin(startApp);
  }
});
```

- [ ] **Step 7: `css/style.css` 최소 스타일 작성**

```css
body { font-family: -apple-system, sans-serif; margin: 0; }
#login-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 16px; }
#tab-nav { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid #ddd; flex-wrap: wrap; }
#tab-nav button { padding: 8px 14px; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
main { padding: 16px; }
.card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
@media (max-width: 480px) {
  #tab-nav button { flex: 1 1 40%; }
}
```

**임시 스텁 (다음 태스크들이 실제 구현으로 교체):**

```javascript
// js/tabs/dashboard.js, intake.js, list.js, field.js, settings.js 각각 임시로:
function renderDashboardTab(container) { container.textContent = '준비 중'; }
```
(각 파일에 해당 함수 이름만 맞춰 동일한 임시 구현을 넣는다 — Task 10~14에서 실제 구현으로 교체)

- [ ] **Step 8: 브라우저에서 수동 확인**

로컬에서 정적 서버로 열기 (예: VSCode Live Server 또는 `npx serve`), 로그인 화면이 뜨고 탭 버튼 클릭 시 "준비 중"이 표시되는지 확인. (`config.js`의 플레이스홀더 값 때문에 실제 로그인은 Task 8 배포 완료 후에만 동작)

- [ ] **Step 9: 커밋**

```bash
git add js/ index.html css/style.css
git commit -m "feat: frontend shell, auth, api wrapper, tab navigation"
```

---

### Task 10: 접수 탭 (`js/tabs/intake.js`)

**Files:**
- Modify: `js/tabs/intake.js` (스텁을 실제 구현으로 교체)

**Interfaces:**
- Consumes: `callApi` (Task 9), `escapeHtml` (Task 9)
- Produces: `renderIntakeTab(container)`

- [ ] **Step 1: `js/tabs/intake.js` 작성**

```javascript
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
  form.customerType.addEventListener && null; // no-op guard for older browsers

  form.querySelector('[name="고객분류"]').addEventListener('change', (e) => {
    document.getElementById('delivery-done-field').style.display =
      e.target.value === '런드리고' ? 'block' : 'none';
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
      document.getElementById('delivery-done-field').style.display = 'none';
    } else {
      alert('접수 실패: ' + result.error);
    }
  });
}
```

- [ ] **Step 2: 브라우저 수동 확인**

Task 8 배포와 `js/config.js` 실제 값 반영 후: 접수 탭에서 필수값을 채우고 제출 → "접수되었습니다." 알림 확인 → Google Sheets의 `AS접수` 시트에 새 행이 추가됐는지 확인. 필수값을 비우고 제출 시 서버가 `ok:false`와 누락 필드 메시지를 반환하는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add js/tabs/intake.js
git commit -m "feat: intake tab form"
```

---

### Task 11: 목록 탭 (`js/tabs/list.js`)

**Files:**
- Modify: `js/tabs/list.js`

**Interfaces:**
- Consumes: `callApi`, `escapeHtml` (Task 9), `handleListStatus_` 결과(상태값 드롭다운 구성용)

- [ ] **Step 1: `js/tabs/list.js` 작성**

```javascript
const LIST_FILTERS = {
  '전체': null,
  '접수 필요': (r) => r.상태 === '접수 필요',
  '회수 필요': (r) => r.상태 === '회수 필요',
  '중동사 진행': (r) => r.매장위치 === '중동사',
  '아토즈레더 진행': (r) => r.매장위치 === '아토즈레더',
  '택배 접수': (r) => String(r.매장위치 || '').indexOf('택배') !== -1
};

async function renderListTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';

  const [listResult, statusResult] = await Promise.all([
    callApi('listAS', {}),
    callApi('listStatus', {})
  ]);

  if (!listResult.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(listResult.error)}</div>`;
    return;
  }

  const statusOptions = statusResult.ok ? statusResult.items : [];
  let currentFilter = '전체';

  function draw() {
    const filterFn = LIST_FILTERS[currentFilter];
    const items = filterFn ? listResult.items.filter(filterFn) : listResult.items;

    const filterButtons = Object.keys(LIST_FILTERS).map((name) =>
      `<button data-filter="${escapeHtml(name)}" class="${name === currentFilter ? 'active' : ''}">${escapeHtml(name)}</button>`
    ).join('');

    const rows = items.map((item) => {
      const statusOptionsHtml = statusOptions.map((s) =>
        `<option value="${escapeHtml(s)}" ${s === item.상태 ? 'selected' : ''}>${escapeHtml(s)}</option>`
      ).join('');
      return `
        <div class="card" data-id="${escapeHtml(item.id)}">
          <strong>${escapeHtml(item.브랜드)}</strong> / ${escapeHtml(item.품목)} / ${escapeHtml(item.고객분류)}
          <div>접수일: ${escapeHtml(item.접수일시)} · 접수자: ${escapeHtml(item.접수자)}</div>
          <select class="status-select">${statusOptionsHtml}</select>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div id="list-filters">${filterButtons}</div>
      <div id="list-items">${rows || '<div>표시할 항목이 없습니다.</div>'}</div>
    `;

    container.querySelectorAll('#list-filters button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        draw();
      });
    });

    container.querySelectorAll('.status-select').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = e.target.closest('.card').dataset.id;
        const result = await callApi('updateStatus', { id: id, status: e.target.value });
        if (!result.ok) alert('상태 변경 실패: ' + result.error);
      });
    });
  }

  draw();
}
```

- [ ] **Step 2: 브라우저 수동 확인**

목록 탭에서 필터 버튼 클릭 시 항목이 걸러지는지, 상태 드롭다운 변경 시 시트의 `상태` 컬럼이 바뀌는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add js/tabs/list.js
git commit -m "feat: list tab with filters and status update"
```

---

### Task 12: 대시보드 탭 (`js/tabs/dashboard.js`)

**Files:**
- Modify: `js/tabs/dashboard.js`

**Interfaces:**
- Consumes: `callApi('dashboard', {})` → `{ok, needIntake, needPickup, agingBuckets, byStaff}` (Task 6)

- [ ] **Step 1: `js/tabs/dashboard.js` 작성**

```javascript
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
```

- [ ] **Step 2: 브라우저 수동 확인**

대시보드 탭 진입 시 숫자가 시트 데이터와 일치하는지 확인 (예: 상태='접수 필요'인 행 수와 카드 숫자 비교).

- [ ] **Step 3: 커밋**

```bash
git add js/tabs/dashboard.js
git commit -m "feat: dashboard tab"
```

---

### Task 13: 현장 탭 (`js/tabs/field.js`)

**Files:**
- Modify: `js/tabs/field.js`

**Interfaces:**
- Consumes: `callApi('listAS')`, `callApi('fieldUpdate', {id, fieldStatus, memo})` (Task 5)

- [ ] **Step 1: `js/tabs/field.js` 작성**

```javascript
const FIELD_STATUS_BUTTONS = ['AS불가', '진행중', '수거완료'];

async function renderFieldTab(container) {
  container.innerHTML = '<div>불러오는 중...</div>';
  const result = await callApi('listAS', {});
  if (!result.ok) {
    container.innerHTML = `<div>목록을 불러오지 못했습니다: ${escapeHtml(result.error)}</div>`;
    return;
  }

  const openItems = result.items.filter((item) =>
    item.상태 !== '출고 완료' && item.상태 !== '보상 종결'
  );

  const cards = openItems.map((item) => {
    const buttons = FIELD_STATUS_BUTTONS.map((label) =>
      `<button class="field-status-btn" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`
    ).join('');
    return `
      <div class="card" data-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.브랜드)}</strong> / ${escapeHtml(item.품목)}
        <div>매장위치: ${escapeHtml(item.매장위치)} · 현재상태: ${escapeHtml(item.상태)}</div>
        <div class="field-buttons">${buttons}</div>
        <textarea class="field-memo" placeholder="메모">${escapeHtml(item.현장메모 || '')}</textarea>
      </div>
    `;
  }).join('');

  container.innerHTML = cards || '<div>표시할 항목이 없습니다.</div>';

  container.querySelectorAll('.field-status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.card');
      const id = card.dataset.id;
      const memo = card.querySelector('.field-memo').value;
      const result = await callApi('fieldUpdate', {
        id: id,
        fieldStatus: btn.dataset.label,
        memo: memo
      });
      if (result.ok) {
        alert('저장되었습니다.');
      } else {
        alert('저장 실패: ' + result.error);
      }
    });
  });
}
```

- [ ] **Step 2: 브라우저 수동 확인 (모바일 화면 크기 포함)**

브라우저 개발자 도구로 모바일 화면 크기로 전환해서 카드/버튼이 한 화면에 잘 보이는지 확인. "수거완료" 버튼 클릭 후 목록 탭에서 해당 건 상태가 "회수 완료"로 바뀌었는지, 메모가 저장됐는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add js/tabs/field.js
git commit -m "feat: field tab for on-site staff"
```

---

### Task 14: 설정 탭 (`js/tabs/settings.js`)

**Files:**
- Modify: `js/tabs/settings.js`

**Interfaces:**
- Consumes: `callApi('listStaff')`, `callApi('addStaff')`, `callApi('updateStaff')`, `callApi('listStatus')`, `callApi('addStatus')`, `callApi('deleteStatus')` (Task 7)

- [ ] **Step 1: `js/tabs/settings.js` 작성**

```javascript
async function renderSettingsTab(container) {
  container.innerHTML = `
    <h2>직원 관리</h2>
    <div id="staff-list">불러오는 중...</div>
    <form id="add-staff-form">
      <input type="email" name="이메일" placeholder="이메일" required>
      <input type="text" name="이름" placeholder="이름" required>
      <select name="역할"><option value="일반">일반</option><option value="관리자">관리자</option></select>
      <button type="submit">추가</button>
    </form>

    <h2>상태값 관리</h2>
    <div id="status-list">불러오는 중...</div>
    <form id="add-status-form">
      <input type="text" name="name" placeholder="새 상태값" required>
      <button type="submit">추가</button>
    </form>
  `;

  async function loadStaff() {
    const result = await callApi('listStaff', {});
    const list = document.getElementById('staff-list');
    if (!result.ok) { list.textContent = result.error; return; }
    list.innerHTML = result.items.map((staff) => `
      <div class="card" data-email="${escapeHtml(staff.이메일)}">
        ${escapeHtml(staff.이름)} (${escapeHtml(staff.이메일)}) - ${escapeHtml(staff.역할)}
        <label><input type="checkbox" class="staff-active" ${String(staff.활성여부) === 'true' ? 'checked' : ''}> 활성</label>
      </div>
    `).join('');

    list.querySelectorAll('.staff-active').forEach((checkbox) => {
      checkbox.addEventListener('change', async (e) => {
        const email = e.target.closest('.card').dataset.email;
        await callApi('updateStaff', { email: email, updates: { 활성여부: e.target.checked } });
      });
    });
  }

  async function loadStatus() {
    const result = await callApi('listStatus', {});
    const list = document.getElementById('status-list');
    if (!result.ok) { list.textContent = result.error; return; }
    list.innerHTML = result.items.map((name) => `
      <div class="card" data-name="${escapeHtml(name)}">
        ${escapeHtml(name)} <button class="delete-status-btn">삭제</button>
      </div>
    `).join('');

    list.querySelectorAll('.delete-status-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.closest('.card').dataset.name;
        const result = await callApi('deleteStatus', { name: name });
        if (result.ok) loadStatus();
        else alert('삭제 실패: ' + result.error);
      });
    });
  }

  document.getElementById('add-staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const form = Object.fromEntries(formData.entries());
    const result = await callApi('addStaff', { form: form });
    if (result.ok) { e.target.reset(); loadStaff(); }
    else alert('추가 실패: ' + result.error);
  });

  document.getElementById('add-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    const result = await callApi('addStatus', { name: name });
    if (result.ok) { e.target.reset(); loadStatus(); }
    else alert('추가 실패: ' + result.error);
  });

  loadStaff();
  loadStatus();
}
```

- [ ] **Step 2: 브라우저 수동 확인**

관리자 계정으로 로그인 시에만 설정 탭이 보이는지, 일반 계정으로는 탭 버튼 자체가 숨겨지는지 확인. 직원 추가/비활성화, 상태값 추가/삭제가 실제로 시트에 반영되는지 확인. 일반 계정 세션 토큰으로 `addStaff`를 직접 curl 호출했을 때 서버가 `ok:false`(관리자 아님)로 거부하는지 확인 (프론트 숨김 우회 방어 확인).

- [ ] **Step 3: 커밋**

```bash
git add js/tabs/settings.js
git commit -m "feat: settings tab for staff and status management"
```

---

### Task 15: End-to-end 체크리스트 + GitHub Pages 배포

**Files:**
- Create: `README.md`

**Interfaces:** 없음 (배포/검증 작업)

- [ ] **Step 1: `README.md` 작성 (배포 및 설정 방법 기록)**

```markdown
# 브랜드 AS 관리 페이지

## 배포 방법
1. Google Sheets 새 파일 생성 후 확장 프로그램 > Apps Script에서 `apps-script/` 폴더의 모든 `.gs` 파일과 `appsscript.json`을 붙여넣는다.
2. `setupSpreadsheet` 함수를 한 번 실행해 시트를 초기화한다.
3. 웹앱으로 배포하고 URL을 확보한다.
4. `직원목록` 시트에 최초 관리자 계정을 수동으로 추가한다 (역할=관리자, 활성여부=true).
5. Google Cloud Console에서 OAuth 클라이언트 ID를 발급받는다 (승인된 자바스크립트 원본에 GitHub Pages 도메인 등록).
6. `js/config.js`의 `API_URL`, `GOOGLE_CLIENT_ID`를 실제 값으로 채운다.
7. GitHub 저장소에 push 후 Settings > Pages에서 배포한다.
```

- [ ] **Step 2: 전체 시나리오 수동 테스트**

1. 관리자 계정으로 로그인 → 대시보드/접수/목록/현장/설정 5개 탭 모두 보이는지 확인
2. 접수 탭에서 런드리고/런드리24 각각 1건씩 접수 (런드리고 선택 시 배송완료처리 필드 노출 확인)
3. 목록 탭에서 방금 접수한 건이 보이고, 필터로 걸러지는지 확인
4. 대시보드에서 접수 필요 수량이 방금 추가한 건만큼 늘었는지 확인
5. 현장 탭에서 "수거완료" 버튼으로 상태 변경 + 메모 저장 → 목록 탭에서 상태가 "회수 완료"로 바뀌었는지 확인
6. 설정 탭에서 일반 직원 1명 추가 → 그 계정으로 로그인해서 설정 탭이 안 보이는지 확인
7. 화이트리스트에 없는 구글 계정으로 로그인 시도 → 거부 메시지 확인

- [ ] **Step 3: 커밋 및 GitHub push**

```bash
git add README.md
git commit -m "docs: deployment guide"
git remote add origin <GitHub 저장소 URL>
git push -u origin main
```

---

## 자체 검토 결과

- **스펙 커버리지**: 로그인(화이트리스트+역할), 접수 폼(런드리고 조건부 필드), 목록(필터+상태변경), 대시보드(집계 3종), 현장 탭(3단계 매핑+메모), 설정 탭(직원관리+상태값관리, 관리자 전용) 모두 태스크로 매핑됨. 요청건관련메모/구매정보 삭제 반영됨.
- **플레이스홀더 점검**: `config.js`의 `API_URL`/`GOOGLE_CLIENT_ID`만 배포 시점에 채워야 하는 값으로 남겨둠 (설계상 필연적인 배포 후 설정값이며, Task 8/15에서 채우는 절차를 명시함 — TBD성 플레이스홀더 아님).
- **타입/이름 일관성**: `FIELD_STATUS_MAP`, `computeAgingBucket`, `rowToObject`/`objectToRow`, `requireSession_`/`requireAdmin_`, action 이름(`login`/`submitAS`/`listAS`/`updateStatus`/`fieldUpdate`/`dashboard`/`listStaff`/`addStaff`/`updateStaff`/`listStatus`/`addStatus`/`deleteStatus`) 모두 스펙 문서(6절) 및 태스크 전체에서 동일하게 사용됨.
