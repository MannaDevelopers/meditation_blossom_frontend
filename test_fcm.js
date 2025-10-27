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
async function sendTopicMessage(topicName = 'sermon_events') {
  try {
    const message = {
      topic: topicName,
      notification: {
        title: '새로운 설교',
        body: '새로운 설교가 업데이트되었습니다.'
      },
      data: {
        topic: topicName, // 토픽 정보를 data에 포함
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
    console.log(`📱 ${topicName} 토픽 구독자들에게 전송되었습니다.`);
    
  } catch (error) {
    console.error('❌ 토픽 메시지 전송 실패:', error);
  }
}

// Data-only 메시지 전송 함수 (알림 없이 백그라운드 처리)
async function sendDataOnlyMessage(topicName = 'sermon_events') {
  try {
    const message = {
      topic: topicName,
      data: {
        topic: topicName, // 토픽 정보를 data에 포함
        id: Date.now().toString(),
        title: '17.하나님 경험하기(하나님의 임재연습)',
        category: '주말의 명작',
        content: '본문 : 요한복음 4:5-30 5 사마리아에 있는 수가라 하는 동네에 이르시니 야곱이 그 아들 요셉에게 준 땅이 가깝고 6 거기 또 야곱의 우물이 있더라 예수께서 길 가시다가 피곤하여 우물 곁에 그대로 앉으시니 때가 여섯 시쯤 되었더라 7 사마리아 여자 한 사람이 물을 길으러 왔으매 예수께서 물을 좀 달라 하시니 8 이는 제자들이 먹을 것을 사러 그 동네에 들어갔음이러라 9 사마리아 여자가 이르되 당신은 유대인으로서 어찌하여 사마리아 여자인 나에게 물을 달라 하나이까 하니 이는 유대인이 사마리아인과 상종하지 아니함이러라 10 예수께서 대답하여 이르시되 네가 만일 하나님의 선물과 또 네게 물 좀 달라 하는 이가 누구인 줄 알았더라면 네가 그에게 구하였을 것이요 그가 생수를 네게 주었으리라 11 여자가 이르되 주여 물 길을 그릇도 없고 이 우물은 깊은데 어디서 당신이 그 생수를 얻겠사옵나이까 12 우리 조상 야곱이 이 우물을 우리에게 주셨고 또 여기서 자기와 자기 아들들과 짐승이 다 마셨는데 당신이 야곱보다 더 크니이까 13 예수께서 대답하여 이르시되 이 물을 마시는 자마다 다시 목마르려니와 14 내가 주는 물을 마시는 자는 영원히 목마르지 아니하리니 내가 주는 물은 그 속에서 영생하도록 솟아나는 샘물이 되리라 15 여자가 이르되 주여 그런 물을 내게 주사 목마르지도 않고 또 여기 물 길으러 오지도 않게 하옵소서 16 이르시되 가서 네 남편을 불러 오라 17 여자가 대답하여 이르되 나는 남편이 없나이다 예수께서 이르시되 네가 남편이 없다 하는 말이 옳도다 18 너에게 남편 다섯이 있었고 지금 있는 자도 네 남편이 아니니 네 말이 참되도다 19 여자가 이르되 주여 내가 보니 선지자로소이다 20 우리 조상들은 이 산에서 예배하였는데 당신들의 말은 예배할 곳이 예루살렘에 있다 하더이다 21 예수께서 이르시되 여자여 내 말을 믿으라 이 산에서도 말고 예루살렘에서도 말고 너희가 아버지께 예배할 때가 이르리라 22 너희는 알지 못하는 것을 예배하고 우리는 아는 것을 예배하노니 이는 구원이 유대인에게서 남이라 23 아버지께 참되게 예배하는 자들은 영과 진리로 예배할 때가 오나니 곧 이 때라 아버지께서는 자기에게 이렇게 예배하는 자들을 찾으시느니라 24 하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라 25 여자가 이르되 메시야 곧 그리스도라 하는 이가 오실 줄을 내가 아노니 그가 오시면 모든 것을 우리에게 알려 주시리이다 26 예수께서 이르시되 네게 말하는 내가 그라 하시니라 27 이 때에 제자들이 돌아와서 예수께서 여자와 말씀하시는 것을 이상히 여겼으나 무엇을 구하시나이까 어찌하여 그와 말씀하시나이까 묻는 자가 없더라 28 여자가 물동이를 버려 두고 동네로 들어가서 사람들에게 이르되 29 내가 행한 모든 일을 내게 말한 사람을 와서 보라 이는 그리스도가 아니냐 하니 30 그들이 동네에서 나와 예수께로 오더라',
        date: '2025-10-26',
        day_of_week: 'SUN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        operation: ''
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1
          }
        },
        headers: {
          'apns-priority': '5',
          'apns-push-type': 'background'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Data-only 메시지 전송 성공:', response);
    console.log(`📱 ${topicName} 토픽 구독자들에게 백그라운드로 전송되었습니다.`);
    
  } catch (error) {
    console.error('❌ Data-only 메시지 전송 실패:', error);
  }
}

// 사용법 안내
console.log('🚀 FCM 테스트 스크립트');
console.log('');
console.log('사용법:');
console.log('1. firebase-service-account.json 파일을 프로젝트 루트에 추가');
console.log('2. FCM_TOKEN 변수에 실제 토큰 입력');
console.log('3. 다음 명령어 실행:');
console.log('   - node test_fcm.js sendTest (개별 디바이스)');
console.log('   - node test_fcm.js sendTopic [토픽이름] (알림 포함)');
console.log('   - node test_fcm.js sendDataOnly [토픽이름] (백그라운드 data-only)');
console.log('');
console.log('예시:');
console.log('   - node test_fcm.js sendTopic sermon_events_test');
console.log('   - node test_fcm.js sendDataOnly sermon_events_test');
console.log('');

// 명령행 인수 처리
const command = process.argv[2];
const topicArg = process.argv[3];

if (command === 'sendTest') {
  sendTestMessage();
} else if (command === 'sendTopic') {
  const topic = topicArg || 'sermon_events';
  console.log(`📤 ${topic} 토픽으로 메시지 전송 중... (알림 포함)`);
  sendTopicMessage(topic);
} else if (command === 'sendDataOnly') {
  const topic = topicArg || 'sermon_events';
  console.log(`📤 ${topic} 토픽으로 Data-only 메시지 전송 중... (백그라운드)`);
  sendDataOnlyMessage(topic);
} else {
  console.log('❌ 잘못된 명령어입니다.');
  console.log('사용 가능한 명령어: sendTest, sendTopic [토픽이름], sendDataOnly [토픽이름]');
} 