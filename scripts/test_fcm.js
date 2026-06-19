#!/usr/bin/env node
// FCM 테스트 도구
// 사용법: yarn fcm  (또는 node test_fcm.js)

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Firebase 초기화 ──────────────────────────────────────────
const LOCAL_SA = path.join(__dirname, 'firebase-service-account.json');
const TOKEN_FILE = path.join(__dirname, '.fcm_token.local');
const COUNTER_FILE = path.join(__dirname, '.fcm_counter.local');
const DATA_FILE = path.join(__dirname, 'fcm_test_data.json');

if (fs.existsSync(LOCAL_SA)) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  admin.initializeApp({ credential: admin.credential.cert(require(LOCAL_SA)), projectId: process.env.FIREBASE_PROJECT_ID || 'muksang-mangae' });
  console.log('🔐 firebase-service-account.json 사용');
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || 'muksang-mangae' });
  console.log('🔐 Application Default Credentials 사용');
}

// ── 토큰 관리 ────────────────────────────────────────────────
function loadToken() {
  if (process.env.FCM_TOKEN) return process.env.FCM_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  return null;
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_FILE, token.trim(), 'utf8');
}

function maskToken(token) {
  if (!token || token.length < 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

// ── 전송 카운터 ──────────────────────────────────────────────
// 보낼 때마다 증가. 제목에 [#N] 을 붙여서 수신 여부를 쉽게 구분
function bumpCounter() {
  let n = 0;
  if (fs.existsSync(COUNTER_FILE)) {
    n = parseInt(fs.readFileSync(COUNTER_FILE, 'utf8').trim(), 10) || 0;
  }
  n += 1;
  fs.writeFileSync(COUNTER_FILE, String(n), 'utf8');
  return n;
}

// ── 테스트 데이터 로드 ───────────────────────────────────────
// fcm_test_data.json 을 편집하면 JS 파일 수정 없이 데이터 변경 가능
// label: 전체 시나리오 테스트 시 앱 상태 표시 (예: "포그라운드")
function loadData(topic, label = null) {
  const base = {
    source_id: Date.now().toString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    operation: 'UPDATED',
  };

  let data;

  if (fs.existsSync(DATA_FILE)) {
    try {
      const file = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (file[topic]) data = { topic, ...base, ...file[topic] };
    } catch {
      console.warn(`⚠️  ${DATA_FILE} 파싱 실패, 기본값 사용`);
    }
  }

  if (!data) {
    data = topic === 'qt_events'
      ? {
          ...base, topic: 'qt_events',
          title: 'QT 테스트: 오늘의 묵상', series_title: '매일만나',
          date: new Date().toISOString().split('T')[0],
          year: String(new Date().getFullYear()), day_of_week: 'MON',
          bible_references: '[{"book": "시편", "chapter": 23, "verse_start": 1, "verse_end": 3}]',
          meditation_questions: '["묵상 질문 1", "묵상 질문 2", "묵상 질문 3"]',
        }
      : {
          ...base, topic: 'sermon_events_v2',
          title: '4. 믿음은 하나님의 주권을 인정하는 것이다!',
          category: '믿음으로 새롭게',
          date: new Date().toISOString().split('T')[0],
          year: String(new Date().getFullYear()), day_of_week: 'SUN',
          bible_references: '[{"book": "갈라디아서", "chapter": 2, "verse_start": 20, "verse_end": 20}]',
        };
  }

  // 수신 구분을 위해 제목 앞에 [#N] 또는 [#N 상태] 추가
  const n = bumpCounter();
  const prefix = label ? `[#${n} ${label}]` : `[#${n}]`;
  return { ...data, title: `${prefix} ${data.title}` };
}

function toStr(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
}

// ── 전송 함수 ────────────────────────────────────────────────
// sermon_event.py 의 _send_to_topic() 구조와 동일 (기본 권장)
async function sendSermonEvent(token, dataType = 'sermon_events', label = null) {
  const rawData = loadData(dataType, label);
  const dataFields = toStr(rawData);
  return admin.messaging().send({
    ...(token ? { token } : { topic: rawData.topic }),
    android: { priority: 'normal', data: dataFields },
    apns: {
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
      // mutable-content: 1 이 있어야 UNNotificationServiceExtension 이 실행된다.
      // 확장이 App Group 저장 + reloadTimelines 를 담당하므로 위젯 업데이트에 필수.
      payload: { aps: { 'content-available': 1, 'mutable-content': 1, alert: { title: '', body: '' }, badge: 0 }, ...dataFields },
    },
  });
}

// data-only 백그라운드 메시지
async function sendDataOnly(token, dataType = 'sermon_events', label = null) {
  const rawData = loadData(dataType, label);
  const dataFields = toStr(rawData);
  return admin.messaging().send({
    ...(token ? { token } : { topic: rawData.topic }),
    data: dataFields,
    android: { priority: 'high' },
    apns: {
      payload: { aps: { 'content-available': 1 } },
      headers: { 'apns-priority': '5', 'apns-push-type': 'background' },
    },
  });
}

// 알림 포함 메시지 (앱 종료 상태에서도 수신 가능)
async function sendNotification(token, dataType = 'sermon_events', label = null) {
  const rawData = loadData(dataType, label);
  const dataFields = toStr(rawData);
  return admin.messaging().send({
    ...(token ? { token } : { topic: rawData.topic }),
    notification: { title: '새로운 설교', body: '새로운 설교가 업데이트되었습니다.' },
    data: dataFields,
    android: { priority: 'high', notification: { sound: 'default', channelId: rawData.topic } },
    apns: {
      payload: { aps: { 'content-available': 1, sound: 'default', badge: 1 } },
      headers: { 'apns-priority': '10' },
    },
  });
}

// WidgetKit Push - iOS 위젯 업데이트 + Android onMessageReceived 트리거
async function sendWidgetKitPush(token, dataType = 'sermon_events', label = null) {
  const rawData = loadData(dataType, label);
  const dataFields = toStr(rawData);
  const silentFields = { ...dataFields, silent: 'true', widget_update_only: 'true' };
  const dest = token ? { token } : { topic: rawData.topic };

  console.log('  📤 Step 1: iOS Extension 메시지 전송...');
  await admin.messaging().send({
    ...dest,
    data: silentFields,
    android: { priority: 'high' },
    apns: {
      payload: { aps: { 'content-available': 1, alert: { title: '', body: '' }, badge: 0 } },
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
    },
  });

  await new Promise(r => setTimeout(r, 300));

  console.log('  📤 Step 2: WidgetKit Push 전송...');
  return admin.messaging().send({
    ...dest,
    data: silentFields,
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: { 'content-available': 1 },
        widgetkit: { reloadTimelines: ['MeditationBlossomWidget'], data: rawData },
      },
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
    },
    fcmOptions: { analyticsLabel: 'widgetkit_push' },
  });
}

// ── 메뉴 정의 ────────────────────────────────────────────────
const METHODS = [
  { label: 'sendSermonEvent  — 실제 서버 방식 (권장)', fn: sendSermonEvent },
  { label: 'sendDataOnly     — data-only, 백그라운드', fn: sendDataOnly },
  { label: 'sendNotification — 알림 포함', fn: sendNotification },
  { label: 'sendWidgetKitPush — 위젯만 업데이트 (2단계)', fn: sendWidgetKitPush },
];

const TOPICS = [
  { label: 'sermon_events  → sermon_events_v2 (주일 말씀)', value: 'sermon_events' },
  { label: 'qt_events      → qt_events (매일 만나 QT)',      value: 'qt_events' },
];

// ── readline 헬퍼 ────────────────────────────────────────────
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function askChoice(rl, question, choices) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  for (;;) {
    const raw = (await ask(rl, `선택 (1-${choices.length}): `)).trim();
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= choices.length) return n - 1;
    console.log(`  ❗ 1~${choices.length} 사이 숫자를 입력하세요.`);
  }
}

// ── 전체 시나리오 가이드 ─────────────────────────────────────
// test_cases.md 의 Main App + Widget 테스트를 순서대로 안내
// 각 전송마다 [#N 상태] 형태로 제목에 붙어 수신 구분 가능
const SCENARIOS = [
  { state: '포그라운드', instruction: '앱을 열고 화면에 보이는 상태로 두세요.' },
  { state: '백그라운드', instruction: '홈 버튼으로 앱을 백그라운드로 보내세요. (완전히 종료 X)' },
  { state: '종료',      instruction: '앱을 완전히 종료하세요. (최근 앱에서 스와이프)' },
];

async function runFullScenario(rl, token) {
  const idx = await askChoice(rl, '테스트할 토픽:', [
    ...TOPICS.map(t => t.label),
    '둘 다 (sermon_events + qt_events)',
  ]);
  const topics = idx === TOPICS.length ? TOPICS.map(t => t.value) : [TOPICS[idx].value];

  const total = SCENARIOS.length * topics.length;
  let step = 0;

  for (const topic of topics) {
    for (const scenario of SCENARIOS) {
      step++;
      console.log(`\n${'━'.repeat(52)}`);
      console.log(`[${step}/${total}] ${topic}  —  앱 ${scenario.state}`);
      console.log(`  → ${scenario.instruction}`);
      await ask(rl, '  준비됐으면 Enter...');
      try {
        // label 을 scenario.state 로 전달 → 제목에 [#N 포그라운드] 형태로 표시
        await sendSermonEvent(token, topic, scenario.state);
        console.log('  ✅ 전송 완료!');
      } catch (e) {
        console.error(`  ❌ 전송 실패: ${e.message}`);
      }
      await ask(rl, '  앱/위젯에 변경이 반영됐나요? 확인 후 Enter...');
    }
  }

  console.log(`\n✅ 전체 시나리오 완료 (${total}/${total})`);
}

// ── 인터랙티브 모드 ──────────────────────────────────────────
async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🚀 FCM 테스트 도구');
  console.log('━'.repeat(52));
  console.log('데이터 편집: fcm_test_data.json');

  // 토큰 확인
  let token = loadToken();
  if (token) {
    console.log(`\n💾 저장된 FCM 토큰: ${maskToken(token)}`);
    const override = (await ask(rl, '사용하려면 Enter, 새 토큰을 입력하려면 직접 입력: ')).trim();
    if (override) { token = override; saveToken(token); console.log('  ✅ 토큰 저장됨'); }
  } else {
    console.log('\n💡 앱 설정 화면에서 "앱 관리"를 5번 탭 → "FCM 토큰 복사"');
    token = (await ask(rl, 'FCM 토큰을 입력하세요: ')).trim();
    if (!token) { console.error('❌ 토큰이 필요합니다.'); rl.close(); return; }
    saveToken(token);
    console.log('  ✅ 토큰 저장됨');
  }

  const methodIdx = await askChoice(rl, '전송 방법 선택:', [
    ...METHODS.map(m => m.label),
    '전체 시나리오 테스트 (포그라운드 → 백그라운드 → 종료 순서로 안내)',
  ]);

  if (methodIdx === METHODS.length) {
    await runFullScenario(rl, token);
    rl.close();
    return;
  }

  const topicIdx = await askChoice(rl, '데이터 토픽 선택:', TOPICS.map(t => t.label));
  const topic = TOPICS[topicIdx].value;

  console.log(`\n📤 전송 중... (${topic}, 내 기기)`);
  try {
    await METHODS[methodIdx].fn(token, topic);
    console.log('✅ 전송 성공!');
  } catch (e) {
    console.error('❌ 전송 실패:', e.message);
  }

  rl.close();
}

// ── CLI 진입점 ───────────────────────────────────────────────
const [,, command, arg, topicArg] = process.argv;

if (!command) {
  interactive().catch(e => { console.error('오류:', e.message); process.exit(1); });

} else if (command === 'save-token') {
  if (!arg) { console.error('❌ 사용법: node test_fcm.js save-token YOUR_FCM_TOKEN'); process.exit(1); }
  saveToken(arg);
  console.log(`✅ 토큰 저장됨: ${maskToken(arg)}`);

} else {
  const fnMap = {
    sendSermonEvent: sendSermonEvent,
    sendDataOnly: sendDataOnly,
    sendNotification: sendNotification,
    sendWidgetKitPush: sendWidgetKitPush,
  };

  const fn = fnMap[command];
  if (!fn) {
    console.error(`❌ 알 수 없는 명령어: ${command}`);
    console.log('사용법: yarn fcm  (인터랙티브 모드)');
    console.log('        node test_fcm.js save-token TOKEN');
    console.log('        node test_fcm.js [sendSermonEvent|sendDataOnly|sendNotification|sendWidgetKitPush] [TOKEN|TOPIC] [sermon_events|qt_events]');
    process.exit(1);
  }

  const token = arg || loadToken();
  const topic = topicArg || 'sermon_events';

  console.log(`📤 ${command} → ${token ? `내 기기 (${maskToken(token)})` : `${topic} 토픽 브로드캐스트`}, 데이터: ${topic}`);
  fn(token, topic)
    .then(() => console.log('✅ 전송 성공'))
    .catch(e => { console.error('❌ 전송 실패:', e.message); process.exit(1); });
}
