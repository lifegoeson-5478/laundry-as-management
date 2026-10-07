// AS 관리 백엔드. 프론트(js/api.js)는 { action, payload }를 POST하고 { ok, ... }를 받는다.
// 배포: supabase functions deploy api --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SESSION_SECRET = Deno.env.get('SESSION_SECRET')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SLACK_CHANNEL_ID = Deno.env.get('SLACK_CHANNEL_ID');

const AS = 'AS접수';
const STAFF = '직원목록';
const HISTORY = '상태변경이력';
const STATUS = '상태값';

const AS_REQUIRED_FIELDS = [
  '고객분류', '회원카드', '회원연락처', '수거요청일자', '바코드번호',
  '브랜드', '품목', '품번', '생산연도', '사이즈', '색상',
  '매장위치', '브랜드AS동의일', '손상부위'
];
const AS_EDITABLE_FIELDS = [...AS_REQUIRED_FIELDS, '요청건관련메모', '런드리고배송완료처리'];
const STAFF_EDITABLE_FIELDS = ['이름', '역할', '활성여부'];
const FIELD_STATUS_MAP: Record<string, string> = {
  'AS불가': 'AS 불가',
  '진행중': 'AS 진행중',
  '수거완료': '회수 완료'
};

type Payload = Record<string, any>;
type Session = { email: string; name: string; role: string; exp: number };

// 테이블 타입을 생성하지 않았으므로 결과는 any로 다룬다.
function must(res: { data: unknown; error: any }): any {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------- 세션 (Auth.gs와 같은 방식: base64url(payload).HMAC) ----------
const enc = new TextEncoder();
const hmacKey = await crypto.subtle.importKey(
  'raw', enc.encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
);
const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function createSessionToken(email: string, name: string, role: string) {
  const body = toB64url(enc.encode(JSON.stringify({ email, name, role, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(body)));
  return body + '.' + toB64url(sig);
}

async function verifySessionToken(token: string): Promise<Session | null> {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', hmacKey, fromB64url(sig), enc.encode(body)))) return null;
    const session = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

async function requireSession(p: Payload) {
  const session = await verifySessionToken(p.token);
  if (!session) throw new Error('로그인이 필요하거나 세션이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.');
  return session;
}

async function requireAdmin(p: Payload) {
  const session = await requireSession(p);
  if (session.role !== '관리자') throw new Error('관리자만 사용할 수 있는 기능입니다.');
  return session;
}

async function login(p: Payload) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(p.idToken || ''));
  const google = res.ok ? await res.json() : null;
  if (!google?.email || google.aud !== GOOGLE_CLIENT_ID) {
    return { ok: false, error: '구글 로그인 검증에 실패했습니다.' };
  }
  const staff = must(await db.from(STAFF).select('*').eq('이메일', google.email).maybeSingle());
  if (!staff || !staff.활성여부) {
    return { ok: false, error: '등록되지 않았거나 비활성화된 계정입니다. 관리자에게 문의하세요.' };
  }
  const token = await createSessionToken(staff.이메일, staff.이름, staff.역할);
  return { ok: true, session: { email: staff.이메일, name: staff.이름, role: staff.역할, token } };
}

// ---------- AS ----------
// Supabase는 한 번에 최대 1000행만 돌려주므로 나눠서 전부 가져온다.
async function listAllAS() {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from(AS).select('*').order('접수일시', { ascending: true }).range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function getAS(id: string) {
  return must(await db.from(AS).select('*').eq('id', id).maybeSingle());
}

async function logStatusChange(asId: string, actor: string, oldStatus: string, newStatus: string) {
  must(await db.from(HISTORY).insert({
    id: crypto.randomUUID(), 대상id: asId, 변경자: actor, 이전상태: oldStatus || '', 새상태: newStatus
  }));
}

async function submitAS(p: Payload) {
  const session = await requireSession(p);
  const form = p.form || {};
  const missing = AS_REQUIRED_FIELDS.filter((f) => !form[f]);
  if (missing.length > 0) return { ok: false, error: '필수 항목이 비어있습니다: ' + missing.join(', ') };

  const record: Record<string, any> = { id: crypto.randomUUID(), 접수일시: new Date().toISOString(), 접수자: session.name };
  AS_REQUIRED_FIELDS.forEach((f) => (record[f] = form[f]));
  record.요청건관련메모 = form.요청건관련메모 || '';
  record.런드리고배송완료처리 = form.고객분류 === '런드리고' ? (form.런드리고배송완료처리 || '') : '';
  record.상태 = '접수 필요';
  record.현장메모 = '';

  must(await db.from(AS).insert(record));
  return { ok: true, record };
}

async function checkDuplicateAS(p: Payload) {
  await requireSession(p);
  if (!p.회원카드 || !p.바코드번호) return { ok: true, items: [] };
  const items = must(await db.from(AS).select('*').eq('회원카드', p.회원카드).eq('바코드번호', p.바코드번호));
  return { ok: true, items };
}

async function listAS(p: Payload) {
  await requireSession(p);
  return { ok: true, items: await listAllAS() };
}

async function updateAS(p: Payload) {
  await requireSession(p);
  if (!p.id) return { ok: false, error: 'id가 필요합니다.' };
  const form = p.form || {};
  const updates: Record<string, any> = {};
  AS_EDITABLE_FIELDS.forEach((f) => { if (form[f] !== undefined) updates[f] = form[f]; });
  const rows = must(await db.from(AS).update(updates).eq('id', p.id).select('id'));
  if (!rows.length) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

async function deleteAS(p: Payload) {
  await requireSession(p);
  if (!p.id) return { ok: false, error: 'id가 필요합니다.' };
  const rows = must(await db.from(AS).delete().eq('id', p.id).select('id'));
  if (!rows.length) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  return { ok: true };
}

// 버튼을 누른 시점 기준 6개월 전보다 먼저 접수된 건 삭제. dryRun이면 건수만 센다.
async function deleteOldAS(p: Payload) {
  await requireAdmin(p);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const before = cutoff.toISOString();
  if (p.dryRun) {
    const { count, error } = await db.from(AS).select('id', { count: 'exact', head: true }).lt('접수일시', before);
    if (error) throw new Error(error.message);
    return { ok: true, count: count || 0, cutoff: before };
  }
  const rows = must(await db.from(AS).delete().lt('접수일시', before).select('id'));
  return { ok: true, count: rows.length, cutoff: before };
}

async function updateStatus(p: Payload) {
  const session = await requireSession(p);
  if (!p.id || !p.status) return { ok: false, error: 'id와 status가 필요합니다.' };
  const current = await getAS(p.id);
  if (!current) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  must(await db.from(AS).update({ 상태: p.status }).eq('id', p.id));
  await logStatusChange(p.id, session.name, current.상태, p.status);
  return { ok: true };
}

async function listStatusHistory(p: Payload) {
  await requireSession(p);
  if (!p.id) return { ok: false, error: 'id가 필요합니다.' };
  const items = must(await db.from(HISTORY).select('*').eq('대상id', p.id).order('변경일시', { ascending: false }));
  return { ok: true, items };
}

async function fieldUpdate(p: Payload) {
  const session = await requireSession(p);
  if (!p.id || !p.fieldStatus) return { ok: false, error: 'id와 fieldStatus가 필요합니다.' };
  const mapped = FIELD_STATUS_MAP[p.fieldStatus];
  if (!mapped) return { ok: false, error: '알 수 없는 현장 상태입니다: ' + p.fieldStatus };

  const item = await getAS(p.id);
  if (!item) return { ok: false, error: '해당 건을 찾을 수 없습니다.' };
  must(await db.from(AS).update({ 상태: mapped, 현장메모: p.memo || '' }).eq('id', p.id));
  await logStatusChange(p.id, session.name, item.상태, mapped);

  const laundry = [item.브랜드, item.품목, item.색상, item.손상부위].filter((v) => v).join(' / ');
  await sendSlackMessage([
    '📦 현장 업데이트',
    '담당자: ' + await mentionForStaffName(item.접수자),
    '회원카드: ' + item.회원카드,
    '회원번호: ' + item.회원연락처,
    '바코드: ' + item.바코드번호,
    'AS 세탁물: ' + laundry,
    '상태: ' + mapped,
    '메모: ' + (p.memo || '')
  ].join('\n'));
  return { ok: true };
}

// ---------- 대시보드 ----------
function computeAgingBucket(pickupDateStr: string, today: Date) {
  const days = Math.floor((today.getTime() - new Date(pickupDateStr).getTime()) / (24 * 60 * 60 * 1000));
  const weeks = days / 7;
  if (weeks <= 2) return '2주 이하';
  if (weeks <= 3) return '3주 이상';
  if (weeks <= 4) return '4주 이상';
  if (weeks <= 5) return '5주 이상';
  return '5주 초과';
}

async function dashboard(p: Payload) {
  await requireSession(p);
  const rows = await listAllAS();
  const today = new Date();
  const count = (obj: Record<string, number>, key: string) => { obj[key] = (obj[key] || 0) + 1; };

  const openRows = rows.filter((r) => r.상태 !== '출고 완료' && r.상태 !== '보상 종결');
  const agingBuckets: Record<string, number> = { '2주 이하': 0, '3주 이상': 0, '4주 이상': 0, '5주 이상': 0, '5주 초과': 0 };
  const byStaff: Record<string, number> = {};
  const byCustomerType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const statusByCustomerType: Record<string, Record<string, number>> = { '런드리고': {}, '런드리24': {} };

  openRows.forEach((r) => {
    if (r.수거요청일자) agingBuckets[computeAgingBucket(r.수거요청일자, today)]++;
    count(byStaff, r.접수자 || '(미상)');
    count(byCustomerType, r.고객분류 || '(미상)');
    count(byStatus, r.상태 || '(미상)');
    if (statusByCustomerType[r.고객분류]) count(statusByCustomerType[r.고객분류], r.상태 || '(미상)');
  });

  return {
    ok: true,
    needIntake: rows.filter((r) => r.상태 === '접수 필요').length,
    needPickup: rows.filter((r) => r.상태 === '회수 필요').length,
    agingBuckets, byStaff, byCustomerType, byStatus, statusByCustomerType,
    totalCount: rows.length,
    totalOpen: openRows.length,
    totalClosed: rows.length - openRows.length
  };
}

// ---------- 직원 ----------
async function listStaff(p: Payload) {
  await requireAdmin(p);
  return { ok: true, items: must(await db.from(STAFF).select('*').order('이름')) };
}

async function addStaff(p: Payload) {
  await requireAdmin(p);
  const form = p.form || {};
  if (!form.이메일 || !form.이름) return { ok: false, error: '이메일과 이름은 필수입니다.' };
  const { error } = await db.from(STAFF).insert({
    이메일: form.이메일, 이름: form.이름, 역할: form.역할 === '관리자' ? '관리자' : '일반', 활성여부: true
  });
  if (error?.code === '23505') return { ok: false, error: '이미 등록된 이메일입니다.' };
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function updateStaff(p: Payload) {
  await requireAdmin(p);
  if (!p.email) return { ok: false, error: 'email이 필요합니다.' };
  const updates: Record<string, any> = {};
  STAFF_EDITABLE_FIELDS.forEach((f) => { if (p.updates?.[f] !== undefined) updates[f] = p.updates[f]; });
  const rows = must(await db.from(STAFF).update(updates).eq('이메일', p.email).select('이메일'));
  if (!rows.length) return { ok: false, error: '해당 이메일을 찾을 수 없습니다.' };
  return { ok: true };
}

async function deleteStaff(p: Payload) {
  const session = await requireAdmin(p);
  if (!p.email) return { ok: false, error: 'email이 필요합니다.' };
  if (p.email === session.email) return { ok: false, error: '본인 계정은 삭제할 수 없습니다.' };
  const rows = must(await db.from(STAFF).delete().eq('이메일', p.email).select('이메일'));
  if (!rows.length) return { ok: false, error: '해당 이메일을 찾을 수 없습니다.' };
  return { ok: true };
}

// ---------- 상태값 ----------
async function listStatus(p: Payload) {
  await requireSession(p);
  const rows = must(await db.from(STATUS).select('*').order('정렬순서'));
  return { ok: true, items: rows.map((r: any) => ({ name: r.상태명, color: r.색상 || '', textColor: r.글자색 || '' })) };
}

async function addStatus(p: Payload) {
  await requireAdmin(p);
  if (!p.name) return { ok: false, error: 'name이 필요합니다.' };
  const last = must(await db.from(STATUS).select('정렬순서').order('정렬순서', { ascending: false }).limit(1));
  const { error } = await db.from(STATUS).insert({
    상태명: p.name, 정렬순서: (last[0]?.정렬순서 || 0) + 1, 색상: p.color || '', 글자색: p.textColor || ''
  });
  if (error?.code === '23505') return { ok: false, error: '이미 존재하는 상태값입니다.' };
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function deleteStatus(p: Payload) {
  await requireAdmin(p);
  if (!p.name) return { ok: false, error: 'name이 필요합니다.' };
  const rows = must(await db.from(STATUS).delete().eq('상태명', p.name).select('상태명'));
  if (!rows.length) return { ok: false, error: '해당 상태값을 찾을 수 없습니다.' };
  return { ok: true };
}

// 드래그로 바꾼 순서대로 정렬순서를 1부터 다시 매긴다. names = 새 순서의 상태명 배열
async function reorderStatus(p: Payload) {
  await requireAdmin(p);
  const names: string[] = Array.isArray(p.names) ? p.names : [];
  if (!names.length) return { ok: false, error: 'names가 필요합니다.' };
  const results = await Promise.all(names.map((name, i) =>
    db.from(STATUS).update({ 정렬순서: i + 1 }).eq('상태명', name)));
  results.forEach(must);
  return { ok: true };
}

async function updateStatusColor(p: Payload) {
  await requireAdmin(p);
  if (!p.name) return { ok: false, error: 'name이 필요합니다.' };
  const rows = must(await db.from(STATUS)
    .update({ 색상: p.color || '', 글자색: p.textColor || '' }).eq('상태명', p.name).select('상태명'));
  if (!rows.length) return { ok: false, error: '해당 상태값을 찾을 수 없습니다.' };
  return { ok: true };
}

// ---------- Slack ----------
async function sendSlackMessage(text: string) {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) return;
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SLACK_BOT_TOKEN },
      body: JSON.stringify({ channel: SLACK_CHANNEL_ID, text })
    });
  } catch (err) {
    console.log('Slack 알림 전송 실패: ' + (err as Error).message);
  }
}

async function mentionForStaffName(name: string) {
  if (!name) return '(미상)';
  const staff = must(await db.from(STAFF).select('이메일').eq('이름', name).limit(1))[0];
  if (!staff || !SLACK_BOT_TOKEN) return name;
  try {
    const res = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(staff.이메일), {
      headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN }
    });
    const data = await res.json();
    if (data.ok && data.user) return '<@' + data.user.id + '>';
  } catch (err) {
    console.log('Slack 사용자 조회 실패: ' + (err as Error).message);
  }
  return name;
}

// ---------- 라우팅 (Code.gs doPost) ----------
const HANDLERS: Record<string, (p: Payload) => Promise<unknown>> = {
  login, submitAS, checkDuplicateAS, listAS, updateAS, deleteAS, deleteOldAS, updateStatus, fieldUpdate,
  listStatusHistory, dashboard, listStaff, addStaff, updateStaff, deleteStaff,
  listStatus, addStatus, deleteStatus, updateStatusColor, reorderStatus
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: '이 API는 POST 요청만 지원합니다.' });

  let body: { action?: string; payload?: Payload };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ ok: false, error: '잘못된 요청 형식입니다.' });
  }
  const handler = HANDLERS[body.action || ''];
  if (!handler) return json({ ok: false, error: '알 수 없는 action입니다: ' + body.action });
  try {
    return json(await handler(body.payload || {}));
  } catch (err) {
    return json({ ok: false, error: (err as Error).message });
  }
});
