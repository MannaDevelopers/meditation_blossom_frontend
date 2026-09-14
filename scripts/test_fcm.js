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

let serviceAccountPath = LOCAL_SA;
if (!fs.existsSync(serviceAccountPath)) {
  const SECRETS_DIR = path.join(__dirname, '../.secrets');
  if (fs.existsSync(SECRETS_DIR)) {
    try {
      const files = fs.readdirSync(SECRETS_DIR);
      const matched = files.find(f => f.startsWith('muksang-mangae') && f.endsWith('.json'));
      if (matched) {
        serviceAccountPath = path.join(SECRETS_DIR, matched);
      }
    } catch (e) {
      // ignore
    }
  }
}

if (fs.existsSync(serviceAccountPath)) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: process.env.FIREBASE_PROJECT_ID || 'muksang-mangae',
  });
  console.log(`🔐 Service Account 사용: ${path.basename(serviceAccountPath)}`);
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

// Firestore 데이터 등록 + FCM 전송
async function updateFirestoreAndSendFcm(token, dataType = 'sermon_events', label = null) {
  const rawData = loadData(dataType, label);
  const db = admin.firestore();
  const collectionName = dataType === 'qt_events' ? 'qt' : 'sermons';

  // Firestore 문서 데이터 준비
  const docData = {
    title: rawData.title,
    date: rawData.date || new Date().toISOString().split('T')[0],
    day_of_week: rawData.day_of_week || '',
    video_url: rawData.video_url || '',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (dataType === 'qt_events') {
    docData.series_title = rawData.series_title || '';
    if (rawData.meditation_questions) {
      try {
        docData.meditation_questions = JSON.parse(rawData.meditation_questions);
      } catch (e) {
        docData.meditation_questions = rawData.meditation_questions.split('\n').filter(Boolean);
      }
    }
  } else {
    docData.category = rawData.category || '';
  }

  if (rawData.bible_references) {
    try {
      docData.bible_references = JSON.parse(rawData.bible_references);
    } catch (e) {
      docData.bible_references = [];
    }
  }

  console.log(`  🔥 Step 1: Firestore 컬렉션 '${collectionName}'에 문서 등록 중...`);
  const docRef = await db.collection(collectionName).add(docData);
  console.log(`  ✅ Firestore 문서 등록 완료! (ID: ${docRef.id})`);

  // FCM 메시지 전송 데이터에 새로 생성된 문서 ID 반영
  rawData.id = docRef.id;
  rawData.source_id = docRef.id;

  const dataFields = toStr(rawData);

  console.log(`  📤 Step 2: FCM 전송 중...`);
  return admin.messaging().send({
    ...(token ? { token } : { topic: rawData.topic }),
    android: { priority: 'high', data: dataFields },
    apns: {
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
      payload: { aps: { 'content-available': 1, 'mutable-content': 1, alert: { title: '', body: '' }, badge: 0 }, ...dataFields },
    },
  });
}

// 주간 전체 5개 예배 일괄 등록 + FCM 전송
// docs/firestore/sermons-v2.md의 ISO 8601 week_number 정의와 동일한 계산
function toIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// sermons-v2 컬렉션에 주말 4개 예배 문서를 등록하고 sermons_v2_events로 FCM을 보낸다.
// (docs/firestore/sermons-v2.md, docs/fcm-event/sermons-v2-events.md 스펙 기준)
async function sendWeeklySermonsScenario(token, topic = 'sermons_v2_events') {
  const db = admin.firestore();

  const today = new Date();
  const diffToSunday = 7 - today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (diffToSunday === 7 ? 0 : diffToSunday));
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() - 1);
  const sundayStr = sunday.toISOString().split('T')[0];
  const saturdayStr = saturday.toISOString().split('T')[0];
  const weekStr = toIsoWeek(sunday);

  console.log(`\n📅 주간 묶음 키(week): ${weekStr}`);

  const worshipOptions = [
    { type: 'SAT_1700', date: saturdayStr, dayLabel: '토요일 오후 5시 예배', videoUrl: 'https://www.youtube.com/watch?v=mock-sat' },
    { type: 'SUN_0950', date: sundayStr, dayLabel: '주일 9시 50분 예배', videoUrl: 'https://www.youtube.com/watch?v=mock-sun' },
    { type: 'SUN_1150', date: sundayStr, dayLabel: '주일 11시 50분 예배', videoUrl: 'https://www.youtube.com/watch?v=mock-sun' },
    { type: 'SUN_1430', date: sundayStr, dayLabel: '주일 2시 30분 예배', videoUrl: 'https://www.youtube.com/watch?v=mock-sun' },
  ];

  const bibleReferences = [{ book: '요한복음', chapter: 3, verse_start: 16, verse_end: 16 }];
  const createdDocs = [];

  for (const opt of worshipOptions) {
    const docId = `${weekStr}_${opt.type}`;
    const sourceId = `mock-${docId}`;
    const docData = {
      week: weekStr,
      worship_type: opt.type,
      date: opt.date,
      title: `${opt.dayLabel} 생명의 말씀 / 모의 설교자`,
      bible_references: bibleReferences,
      source_id: sourceId,
      raw_hash: `mock-hash-${docId}`,
      video_url: opt.videoUrl,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`  🔥 sermons-v2 '${docId}' 문서 등록 중...`);
    await db.collection('sermons-v2').doc(docId).set(docData, { merge: true });
    console.log(`  ✅ '${docId}' 등록 완료!`);
    createdDocs.push({ id: docId, ...docData, sourceId });
  }

  const representative = createdDocs.find(d => d.worship_type === 'SUN_0950');
  const payload = {
    week: weekStr,
    worship_type: representative.worship_type,
    date: representative.date,
    title: representative.title,
    bible_references: JSON.stringify(bibleReferences),
    source_id: representative.sourceId,
    video_url: representative.video_url,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    operation: 'CREATED',
    topic: topic,
  };

  const dataFields = toStr(payload);

  console.log(`  📤 FCM 푸시 알림(${topic}) 전송 중...`);
  return admin.messaging().send({
    ...(token ? { token } : { topic: topic }),
    android: { priority: 'high', data: dataFields },
    apns: {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 }, ...dataFields },
    },
  });
}

// sermons-v2 4개 예배를 video_url 없이 등록 (주보 크롤링 직후, 예배 전 상태 재현).
// 유튜브 버튼 비활성(반투명) UI([#279])를 확인할 때 사용한다.
async function sendWeeklySermonsNoVideoScenario(token, topic = 'sermons_v2_events') {
  const db = admin.firestore();

  const today = new Date();
  const diffToSunday = 7 - today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (diffToSunday === 7 ? 0 : diffToSunday));
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() - 1);
  const sundayStr = sunday.toISOString().split('T')[0];
  const saturdayStr = saturday.toISOString().split('T')[0];
  const weekStr = toIsoWeek(sunday);

  console.log(`\n📅 주간 묶음 키(week): ${weekStr} (video_url 없이 등록)`);

  const worshipOptions = [
    { type: 'SAT_1700', date: saturdayStr, dayLabel: '토요일 오후 5시 예배' },
    { type: 'SUN_0950', date: sundayStr, dayLabel: '주일 9시 50분 예배' },
    { type: 'SUN_1150', date: sundayStr, dayLabel: '주일 11시 50분 예배' },
    { type: 'SUN_1430', date: sundayStr, dayLabel: '주일 2시 30분 예배' },
  ];

  const bibleReferences = [{ book: '요한복음', chapter: 3, verse_start: 16, verse_end: 16 }];
  const createdDocs = [];

  for (const opt of worshipOptions) {
    const docId = `${weekStr}_${opt.type}`;
    const sourceId = `mock-${docId}`;
    // video_url 필드 자체를 생략 — sermons-v2-events.md 스펙상 CREATED 이벤트엔 포함되지 않는다.
    const docData = {
      week: weekStr,
      worship_type: opt.type,
      date: opt.date,
      title: `${opt.dayLabel} 생명의 말씀 / 모의 설교자`,
      bible_references: bibleReferences,
      source_id: sourceId,
      raw_hash: `mock-hash-${docId}-novideo`,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`  🔥 sermons-v2 '${docId}' 문서 등록 중(video_url 없음)...`);
    await db.collection('sermons-v2').doc(docId).set(docData, { merge: true });
    console.log(`  ✅ '${docId}' 등록 완료!`);
    createdDocs.push({ id: docId, ...docData, sourceId });
  }

  const representative = createdDocs.find(d => d.worship_type === 'SUN_0950');
  const payload = {
    week: weekStr,
    worship_type: representative.worship_type,
    date: representative.date,
    title: representative.title,
    bible_references: JSON.stringify(bibleReferences),
    source_id: representative.sourceId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    operation: 'CREATED',
    topic: topic,
  };

  console.log(`  📤 FCM 푸시 알림(${topic}) 전송 중...`);
  return admin.messaging().send({
    ...(token ? { token } : { topic: topic }),
    android: { priority: 'high', data: toStr(payload) },
    apns: {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 }, ...toStr(payload) },
    },
  });
}

// 이미 등록된 최신 주간의 SAT_1700 문서 하나에 video_url을 채우고 UPDATED 이벤트를 보낸다.
// sendWeeklySermonsNoVideoScenario로 먼저 등록한 뒤 실행하는 후속 시나리오 —
// weekly_sermons 캐시가 전체 재조회 없이 이 문서 하나만 patch되는지([#280]),
// 유튜브 버튼이 비활성→활성으로 바뀌는지([#279]) 확인한다.
async function sendVideoUrlUpdateScenario(token, topic = 'sermons_v2_events') {
  const db = admin.firestore();

  const snapshot = await db.collection('sermons-v2').orderBy('week', 'desc').limit(4).get();
  if (snapshot.empty) {
    throw new Error('sermons-v2에 등록된 문서가 없습니다. 먼저 weeklyNoVideo(또는 weekly)를 실행하세요.');
  }
  const latestWeek = snapshot.docs[0].data().week;
  const target = snapshot.docs.find(d => d.data().week === latestWeek && d.data().worship_type === 'SAT_1700')
    ?? snapshot.docs.find(d => d.data().week === latestWeek);
  const data = target.data();

  const videoUrl = 'https://www.youtube.com/watch?v=mock-video-arrived';
  console.log(`\n🎥 '${target.id}' 문서에 video_url 채우는 중... (week=${latestWeek})`);
  await target.ref.update({ video_url: videoUrl, updated_at: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`  ✅ video_url 업데이트 완료!`);

  const payload = {
    week: data.week,
    worship_type: data.worship_type,
    date: data.date,
    title: data.title,
    bible_references: JSON.stringify(data.bible_references),
    source_id: data.source_id,
    video_url: videoUrl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    operation: 'UPDATED',
    topic: topic,
  };

  console.log(`  📤 FCM 푸시 알림(${topic}) 전송 중...`);
  return admin.messaging().send({
    ...(token ? { token } : { topic: topic }),
    android: { priority: 'high', data: toStr(payload) },
    apns: {
      headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
      payload: { aps: { 'content-available': 1 }, ...toStr(payload) },
    },
  });
}

// ── 메뉴 정의 ────────────────────────────────────────────────
const METHODS = [
  { label: 'sendSermonEvent  — 실제 서버 방식 (권장)', fn: sendSermonEvent },
  { label: 'sendDataOnly     — data-only, 백그라운드', fn: sendDataOnly },
  { label: 'sendNotification — 알림 포함', fn: sendNotification },
  { label: 'sendWidgetKitPush — 위젯만 업데이트 (2단계)', fn: sendWidgetKitPush },
  { label: 'updateFirestoreAndSendFcm — Firestore 데이터 등록 후 FCM 발송', fn: updateFirestoreAndSendFcm },
  { label: 'sendWeeklySermonsScenario — sermons-v2 4개 예배 일괄 등록 후 FCM 발송', fn: sendWeeklySermonsScenario },
  { label: 'sendWeeklySermonsNoVideoScenario — video_url 없이 4개 예배 등록 (유튜브 버튼 비활성 테스트)', fn: sendWeeklySermonsNoVideoScenario },
  { label: 'sendVideoUrlUpdateScenario — 최신 주 SAT_1700에 video_url 지연 업데이트 (단일 문서 patch 테스트)', fn: sendVideoUrlUpdateScenario },
];

const TOPICS = [
  { label: 'sermon_events  → sermon_events_v2 (주일 말씀, 레거시/전체)', value: 'sermon_events' },
  { label: 'qt_events      → qt_events (매일 만나 QT)',      value: 'qt_events' },
  { label: 'sermons_v2_events (예배 시간별 말씀, sendWeeklySermonsScenario 전용)', value: 'sermons_v2_events' },
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
    updateFirestoreAndSendFcm: updateFirestoreAndSendFcm,
    sendWeeklySermonsScenario: sendWeeklySermonsScenario,
    weekly: sendWeeklySermonsScenario,
    sendWeeklySermonsNoVideoScenario: sendWeeklySermonsNoVideoScenario,
    weeklyNoVideo: sendWeeklySermonsNoVideoScenario,
    sendVideoUrlUpdateScenario: sendVideoUrlUpdateScenario,
    videoUrlUpdate: sendVideoUrlUpdateScenario,
  };

  const fn = fnMap[command];
  if (!fn) {
    console.error(`❌ 알 수 없는 명령어: ${command}`);
    console.log('사용법: yarn fcm  (인터랙티브 모드)');
    console.log('        node test_fcm.js save-token TOKEN');
    console.log('        node test_fcm.js [sendSermonEvent|sendDataOnly|sendNotification|sendWidgetKitPush|updateFirestoreAndSendFcm|sendWeeklySermonsScenario] [TOKEN|TOPIC] [sermon_events|qt_events]');
    process.exit(1);
  }

  const token = arg || loadToken();
  const topic = topicArg || 'sermon_events';

  console.log(`📤 ${command} → ${token ? `내 기기 (${maskToken(token)})` : `${topic} 토픽 브로드캐스트`}, 데이터: ${topic}`);
  fn(token, topic)
    .then(() => console.log('✅ 전송 성공'))
    .catch(e => { console.error('❌ 전송 실패:', e.message); process.exit(1); });
}
