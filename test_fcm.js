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
// 중요: 알림 콘텐츠 없이 WidgetKit Push만 사용
// 위젯의 getTimeline에서 App Group의 데이터를 읽어서 표시
// 앱이 종료된 상태에서는 Notification Service Extension이 실행되지 않을 수 있으므로
// 위젯이 직접 App Group에서 마지막 데이터를 읽도록 함
async function sendWidgetKitPush(topicName = 'sermon_events') {
  try {
    const sermonData = {
      topic: topicName,
      id: Date.now().toString(),
      title: '[토요설교] 21.밀알로 살아라(닥터 홀의 조선회상)~',
      category: '주말의 명작',
      content: '본문 : 요한복음 12:24-26 24   내가 진실로 진실로 너희에게 이르노니 한 알의 밀이 땅에 떨어져 죽지 아니하면 한 알 그대로 있고 죽으면 많은 열매를 맺느니라 25   자기의 생명을 사랑하는 자는 잃어버릴 것이요 이 세상에서 자기의 생명을 미워하는 자는 영생하도록 보전하리라 26   사람이 나를 섬기려면 나를 따르라 나 있는 곳에 나를 섬기는 자도 거기 있으리니 사람이 나를 섬기면 내 아버지께서 그를 귀히 여기시리라',
      date: '2025-11-22',
      day_of_week: 'SAT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 먼저 data-only 메시지로 App Group에 데이터 저장
    // 앱이 완전히 종료된 상태에서도 Notification Service Extension이 실행되도록
    // 최소한의 알림 콘텐츠를 포함하되, Extension에서 알림을 표시하지 않도록 처리
    // Extension은 silent 플래그를 확인하고 알림을 최소화함
    const dataOnlyMessage = {
      topic: topicName,
      // Extension이 실행되도록 최소한의 알림 콘텐츠 포함
      // Extension에서 silent 플래그를 확인하여 알림을 표시하지 않음
      notification: {
        title: '', // 빈 문자열 - Extension에서 확인하여 표시하지 않음
        body: ''   // 빈 문자열
      },
      data: {
        ...sermonData,
        operation: '',
        'silent': 'true', // Extension이 알림을 표시하지 않도록 플래그
        'widget_update_only': 'true'
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1, // Silent push - Notification Service Extension 실행
            // sound와 badge는 포함하지 않음 (Extension에서 제거할 예정)
            'badge': 0
          }
        },
        headers: {
          // alert가 있으므로 alert 타입 사용 (하지만 빈 콘텐츠)
          'apns-push-type': 'alert',
          'apns-priority': '10' // Alert priority (Extension 실행 보장)
        }
      }
    };

    // 그 다음 WidgetKit Push로 위젯 업데이트 트리거
    // WidgetKit Push는 위젯의 getTimeline을 직접 트리거함
    // 중요: 앱이 완전히 종료된 상태에서도 Notification Service Extension이 실행되도록
    // 최소한의 알림 콘텐츠를 포함하되, Extension에서 silent 플래그를 확인하여 알림을 표시하지 않음
    const widgetKitMessage = {
      topic: topicName,
      // Extension이 실행되도록 최소한의 알림 콘텐츠 포함
      // Extension에서 silent 플래그를 확인하여 알림을 표시하지 않음
      notification: {
        title: '', // 빈 문자열 - Extension에서 확인하여 표시하지 않음
        body: ''   // 빈 문자열
      },
      data: {
        ...sermonData,
        operation: '',
        'silent': 'true', // Extension이 알림을 표시하지 않도록 플래그
        'widget_update_only': 'true'
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1 // Background push - WidgetKit Push에 필수
            // badge는 포함하지 않음 (알림 표시 안 함)
          },
          // WidgetKit Push Notifications: APNs payload의 최상위 레벨에 widgetkit 키 필요
          // Firebase Admin SDK는 apns.payload 안의 내용을 APNs payload로 직접 전달함
          // 따라서 widgetkit을 apns.payload 안에 넣으면 APNs payload의 최상위 레벨에 위치함
          // 중요: reloadTimelines를 포함해야 위젯이 즉시 업데이트됨
          // 하지만 Firebase가 reloadTimelines를 제거할 수 있으므로,
          // Extension에서 reloadTimelines가 없어도 위젯을 업데이트하도록 처리
          widgetkit: {
            // 위젯 타임라인 즉시 리로드 트리거 (앱이 완전히 종료된 상태에서도 작동)
            // Firebase가 reloadTimelines를 제거할 수 있으므로,
            // Extension에서 reloadTimelines가 없어도 위젯을 업데이트하도록 처리
            "reloadTimelines": ["MeditationBlossomWidget"],
            // 위젯이 읽을 수 있도록 데이터도 포함 (App Group에 저장된 후에도 사용 가능)
            data: sermonData
          }
        },
        headers: {
          // WidgetKit Push는 background 타입 사용
          // 앱이 완전히 종료된 상태에서도 위젯을 즉시 업데이트하기 위해 background 타입 필요
          'apns-push-type': 'background',
          'apns-priority': '5' // Background priority (위젯 업데이트에 적합)
        },
        fcmOptions: {
          analyticsLabel: 'widgetkit_push'
        }
      }
    };

    // 먼저 데이터 저장 (Notification Service Extension 실행)
    console.log('📤 Step 1: Sending data-only message to save data in App Group...');
    await admin.messaging().send(dataOnlyMessage);
    console.log('✅ Step 1: Data-only message sent');
    
    // 약간의 지연 후 WidgetKit Push 전송 (데이터가 저장된 후 위젯 업데이트)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 그 다음 WidgetKit Push 전송 (위젯 업데이트 트리거)
    console.log('📤 Step 2: Sending WidgetKit Push to trigger widget update...');
    const response = await admin.messaging().send(widgetKitMessage);
    console.log('✅ Step 2: WidgetKit Push sent');
    
    console.log('✅ WidgetKit Push 전송 성공:', response);
    console.log(`📱 ${topicName} 토픽 구독자들에게 WidgetKit Push가 전송되었습니다.`);
    console.log('📱 위젯만 업데이트되며 사용자 알림은 표시되지 않습니다.');
    
    return response;
    
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