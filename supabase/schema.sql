-- Supabase 대시보드 → SQL Editor에서 한 번 실행한다.
-- 컬럼명은 기존 시트 헤더와 동일하게 유지해 프론트엔드 수정 없이 그대로 쓴다.

create table "AS접수" (
  id text primary key,
  "접수일시" timestamptz default now(),
  "접수자" text default '',
  "고객분류" text default '',
  "회원카드" text default '',
  "회원연락처" text default '',
  "수거요청일자" text default '',
  "바코드번호" text default '',
  "브랜드" text default '',
  "품목" text default '',
  "품번" text default '',
  "생산연도" text default '',
  "사이즈" text default '',
  "색상" text default '',
  "매장위치" text default '',
  "브랜드AS동의일" text default '',
  "손상부위" text default '',
  "요청건관련메모" text default '',
  "런드리고배송완료처리" text default '',
  "상태" text default '',
  "현장메모" text default ''
);
create index on "AS접수" ("접수일시");
create index on "AS접수" ("회원카드", "바코드번호");

create table "직원목록" (
  "이메일" text primary key,
  "이름" text not null,
  "역할" text not null default '일반',
  "활성여부" boolean not null default true
);

create table "상태변경이력" (
  id text primary key,
  "대상id" text not null,
  "변경일시" timestamptz default now(),
  "변경자" text default '',
  "이전상태" text default '',
  "새상태" text default ''
);
create index on "상태변경이력" ("대상id");

create table "상태값" (
  "상태명" text primary key,
  "정렬순서" int not null default 0,
  "색상" text default '',
  "글자색" text default ''
);

-- 정책 없이 RLS만 켜서 anon 접근을 막는다. Edge Function(service role)만 읽고 쓴다.
alter table "AS접수" enable row level security;
alter table "직원목록" enable row level security;
alter table "상태변경이력" enable row level security;
alter table "상태값" enable row level security;

-- 기존 Cleanup.gs 대체: 매일 새벽 3시(KST = 18:00 UTC) 6개월 지난 접수건 삭제
create extension if not exists pg_cron;
select cron.schedule(
  'as-cleanup-old-records',
  '0 18 * * *',
  $$delete from "AS접수" where "접수일시" < now() - interval '6 months'$$
);
