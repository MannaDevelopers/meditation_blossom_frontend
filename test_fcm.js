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
        title: '19. 하나님 예배하기(이것이 예배이다)',
        category: '주말의 명작',
        content: '본문 : 요한복음 4:23-24 23   아버지께 참되게 예배하는 자들은 영과 진리로 예배할 때가 오나니 곧 이 때라 아버지께서는 자기에게 이렇게 예배하는 자들을 찾으시느니라 24   하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라',
        date: '2025-11-09',
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
          'apns-priority': '5', // Background push는 5 사용 (10은 notification용)
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

// WidgetKit Push Notifications 전송 함수 (위젯만 업데이트, 알림 없음)
async function sendWidgetKitPush(topicName = 'sermon_events') {
  try {
    const message = {
      topic: topicName,
      data: {
        topic: topicName,
        id: Date.now().toString(),
        title: '20. 우리의 삶은 은혜의 소산이다!',
        category: '주말의 명작',
        content: '본문 : 디모데전서 4:4-5 4   하나님께서 지으신 모든 것이 선하매 감사함으로 받으면 버릴 것이 없나니 5   하나님의 말씀과 기도로 거룩하여짐이라',
        date: '2025-11-16',
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
            'content-available': 1 // Silent push
          },
          // WidgetKit Push Notifications: APNs payload의 최상위 레벨에 widgetkit 키 필요
          // Firebase Admin SDK는 apns.payload 안의 내용을 그대로 전달하므로,
          // apns.payload.widgetkit이 APNs payload의 최상위 레벨에 widgetkit으로 전달됨
          widgetkit: {
            kind: "MeditationBlossomWidget",
            data: {
              topic: topicName,
              id: Date.now().toString(),
              title: '20. 우리의 삶은 은혜의 소산이다.',
              category: '주말의 명작',
              content: '본문 : 디모데전서 4:4-5 4   하나님께서 지으신 모든 것이 선하매 감사함으로 받으면 버릴 것이 없나니 5   하나님의 말씀과 기도로 거룩하여짐이라',
              date: '2025-11-16',
              day_of_week: 'SUN',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        },
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5' // Background push
        }
      },
      // 참고: Firebase가 widgetkit을 전달하지 못할 경우를 대비해
      // data 필드에도 동일한 데이터를 포함 (fallback으로 사용)
    };

    const response = await admin.messaging().send(message);
    console.log('✅ WidgetKit Push 전송 성공:', response);
    console.log(`📱 ${topicName} 토픽 구독자들에게 WidgetKit Push가 전송되었습니다.`);
    console.log('📱 위젯만 업데이트되며 사용자 알림은 표시되지 않습니다.');
    
  } catch (error) {
    console.error('❌ WidgetKit Push 전송 실패:', error);
  }
}

// Notification을 포함한 메시지 전송 함수 (앱 종료 상태에서도 수신 가능)
async function sendNotificationMessage(topicName = 'sermon_events') {
  try {
    const message = {
      topic: topicName,
      notification: {
        title: '새로운 설교',
        body: '새로운 설교가 업데이트되었습니다.'
      },
      data: {
        topic: topicName, // 토픽 정보를 data에 포함
        id: Date.now().toString(),
        title: '19. 하나님 예배하기(이것이 예배이다)',
        category: '주말의 명작',
        content: '본문 : 요한복음 4:23-24 23   아버지께 참되게 예배하는 자들은 영과 진리로 예배할 때가 오나니 곧 이 때라 아버지께서는 자기에게 이렇게 예배하는 자들을 찾으시느니라 24   하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라',
        date: '2025-11-09',
        day_of_week: 'SUN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        operation: ''
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
            'content-available': 1, // 백그라운드에서도 데이터 처리
            sound: 'default',
            badge: 1
          }
        },
        headers: {
          'apns-priority': '10' // Notification은 10 사용
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification 메시지 전송 성공:', response);
    console.log(`📱 ${topicName} 토픽 구독자들에게 알림과 함께 전송되었습니다.`);
    console.log('📱 앱이 종료된 상태에서도 수신 가능합니다.');
    
  } catch (error) {
    console.error('❌ Notification 메시지 전송 실패:', error);
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
console.log('   - node test_fcm.js sendNotification [토픽이름] (알림 포함, 앱 종료 상태에서도 수신 가능)');
console.log('   - node test_fcm.js sendWidgetKitPush [토픽이름] (WidgetKit Push, 위젯만 업데이트, 알림 없음)');
console.log('');
console.log('예시:');
console.log('   - node test_fcm.js sendTopic sermon_events_test');
console.log('   - node test_fcm.js sendDataOnly sermon_events_test');
console.log('   - node test_fcm.js sendNotification sermon_events_test');
console.log('   - node test_fcm.js sendWidgetKitPush sermon_events_test');
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
} else if (command === 'sendNotification') {
  const topic = topicArg || 'sermon_events';
  console.log(`📤 ${topic} 토픽으로 Notification 메시지 전송 중... (알림 포함, 앱 종료 상태에서도 수신 가능)`);
  sendNotificationMessage(topic);
} else if (command === 'sendWidgetKitPush') {
  const topic = topicArg || 'sermon_events';
  console.log(`📤 ${topic} 토픽으로 WidgetKit Push 전송 중... (위젯만 업데이트, 알림 없음)`);
  sendWidgetKitPush(topic);
} else {
  console.log('❌ 잘못된 명령어입니다.');
  console.log('사용 가능한 명령어: sendTest, sendTopic [토픽이름], sendDataOnly [토픽이름], sendNotification [토픽이름], sendWidgetKitPush [토픽이름]');
} 