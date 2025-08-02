const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'muksang-mangae'
});

// FCM 토큰 (앱에서 로그로 확인한 토큰을 여기에 입력)
const FCM_TOKEN = 'YOUR_FCM_TOKEN_HERE';

// 테스트 메시지 전송 함수
async function sendTestMessage() {
  try {
    const message = {
      token: FCM_TOKEN,
      notification: {
        title: '테스트 메시지',
        body: '앱이 꺼져있을 때 FCM 테스트'
      },
      data: {
        date: '2024-01-15',
        title: '테스트 설교',
        content: '백그라운드 FCM 테스트 내용입니다. 앱이 꺼져있을 때도 잘 작동하는지 확인해보세요.',
        day_of_week: '월요일',
        category: '테스트'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'sermon_events'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ 메시지 전송 성공:', response);
    console.log('📱 기기에서 알림을 확인하세요.');
    console.log('📋 앱이 꺼져있을 때 알림을 탭하여 앱을 실행해보세요.');
    
  } catch (error) {
    console.error('❌ 메시지 전송 실패:', error);
  }
}

// 토픽으로 메시지 전송 함수
async function sendTopicMessage() {
  try {
    const message = {
      topic: 'sermon_events',
      notification: {
        title: '새로운 설교',
        body: '새로운 설교가 업데이트되었습니다.'
      },
      data: {
        date: '2024-01-15',
        title: '토픽 테스트 설교',
        content: '토픽을 통한 FCM 테스트입니다. 모든 구독자에게 전송됩니다.',
        day_of_week: '월요일',
        category: '토픽테스트'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'sermon_events'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ 토픽 메시지 전송 성공:', response);
    console.log('📱 sermon_events 토픽 구독자들에게 전송되었습니다.');
    
  } catch (error) {
    console.error('❌ 토픽 메시지 전송 실패:', error);
  }
}

// 사용법 안내
console.log('🚀 FCM 테스트 스크립트');
console.log('');
console.log('사용법:');
console.log('1. firebase-service-account.json 파일을 프로젝트 루트에 추가');
console.log('2. FCM_TOKEN 변수에 실제 토큰 입력');
console.log('3. 다음 명령어 실행:');
console.log('   - node test_fcm.js sendTest');
console.log('   - node test_fcm.js sendTopic');
console.log('');

// 명령행 인수 처리
const command = process.argv[2];

if (command === 'sendTest') {
  sendTestMessage();
} else if (command === 'sendTopic') {
  sendTopicMessage();
} else {
  console.log('❌ 잘못된 명령어입니다.');
  console.log('사용 가능한 명령어: sendTest, sendTopic');
} 