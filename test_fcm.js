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
      title: '[토요설교] 21.밀알로 살아라(닥터 홀의 조선회상)!',
      category: '주말의 명작',
      content: '본문 : 요한복음 12:24-26 24   내가 진실로 진실로 너희에게 이르노니 한 알의 밀이 땅에 떨어져 죽지 아니하면 한 알 그대로 있고 죽으면 많은 열매를 맺느니라 25   자기의 생명을 사랑하는 자는 잃어버릴 것이요 이 세상에서 자기의 생명을 미워하는 자는 영생하도록 보전하리라 26   사람이 나를 섬기려면 나를 따르라 나 있는 곳에 나를 섬기는 자도 거기 있으리니 사람이 나를 섬기면 내 아버지께서 그를 귀히 여기시리라',
      date: '2025-11-22',
      day_of_week: 'SAT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // WidgetKit Push는 두 가지 메시지로 구성:
    // 1. dataOnlyMessage: iOS Extension 실행을 위한 메시지 (APNs alert 포함, Android에는 무시)
    // 2. widgetKitMessage: 위젯 업데이트용 메시지 (notification 필드 없음)
    //    - iOS: WidgetKit Push로 위젯 업데이트 (background 타입)
    //    - Android: android 설정으로 onMessageReceived 호출하여 위젯 업데이트
    //
    // 최적화된 구조:
    // - iOS: dataOnlyMessage로 Extension 실행 + widgetKitMessage로 위젯 업데이트
    // - Android: widgetKitMessage 하나로 위젯 업데이트 (notification 필드 없으므로 onMessageReceived 호출)
    
    // Step 1: iOS Extension 실행을 위한 메시지
    // iOS: APNs 설정에서 alert를 포함하여 Extension 실행 (alert 타입)
    // Android: notification 필드가 없으므로 알림이 표시되지 않음 (widgetKitMessage에서 처리)
    // 중요: Firebase Admin SDK는 하나의 메시지로 여러 플랫폼에 전송하므로,
    //       최상위 notification 필드를 제거하고 APNs 설정에서만 알림을 포함시킴
    const dataOnlyMessage = {
      topic: topicName,
      // 최상위 notification 필드 제거 - Android에서 알림이 표시되지 않도록 함
      // iOS에서는 APNs 설정(apns.payload.aps.alert)에서 알림을 포함시켜 Extension 실행
      data: {
        ...sermonData,
        operation: '',
        'silent': 'true', // Extension이 알림을 표시하지 않도록 플래그
        'widget_update_only': 'true'
      },
      android: {
        priority: 'high'
        // notification 필드 없음 - Android에서 알림이 표시되지 않음
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1, // Extension 실행 보장
            'alert': {
              // iOS Extension 실행을 위한 빈 alert (Extension에서 제거함)
              'title': '',
              'body': ''
            },
            'badge': 0
          }
        },
        headers: {
          'apns-push-type': 'alert', // alert 타입으로 Extension 실행 보장
          'apns-priority': '10' // Alert priority (Extension 실행 보장)
        }
      }
    };

    // Step 2: WidgetKit Push로 위젯 업데이트 트리거
    // 중요: notification 필드가 없으므로 이 메시지 하나로 Android와 iOS를 모두 처리할 수 있음
    // - Android: android 설정을 사용하여 onMessageReceived 호출 (notification 필드 없음)
    // - iOS: apns 설정을 사용하여 WidgetKit Push 처리 (background 타입)
    // FCM은 플랫폼별로 적절한 설정을 자동으로 적용하므로, 하나의 메시지로 양쪽 모두 처리 가능
    const widgetKitMessage = {
      topic: topicName,
      // notification 필드 없음 - Android와 iOS 모두 data-only 메시지로 처리
      data: {
        ...sermonData,
        operation: '',
        'silent': 'true',
        'widget_update_only': 'true'
      },
      android: {
        priority: 'high'  // Android: onMessageReceived 호출 보장
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1 // Background push - WidgetKit Push에 필수
          },
          // WidgetKit Push Notifications: APNs payload의 최상위 레벨에 widgetkit 키 필요
          widgetkit: {
            "reloadTimelines": ["MeditationBlossomWidget"],
            data: sermonData
          }
        },
        headers: {
          'apns-push-type': 'background', // WidgetKit Push는 background 타입 사용
          'apns-priority': '5' // Background priority (WidgetKit Push에 적합)
        }
      },
      fcmOptions: {
        analyticsLabel: 'widgetkit_push'
      }
    };

    // 최적화된 전송 순서:
    // 1. iOS Extension 메시지 전송 (데이터 저장)
    // 2. WidgetKit Push 전송 (위젯 업데이트)
    //    - iOS: WidgetKit Push로 위젯 업데이트
    //    - Android: widgetKitMessage의 android 설정으로 onMessageReceived 호출하여 위젯 업데이트
    
    // Step 1: iOS Extension 메시지 전송 (데이터 저장)
    console.log('📤 Step 1: Sending iOS Extension message (save data)...');
    await admin.messaging().send(dataOnlyMessage);
    console.log('✅ Step 1: iOS Extension message sent');
    
    // Step 2: WidgetKit Push 전송 (위젯 업데이트)
    // Extension이 데이터를 저장한 후 위젯 업데이트 트리거
    // notification 필드가 없으므로 Android와 iOS 모두 처리됨
    await new Promise(resolve => setTimeout(resolve, 300)); // Extension이 데이터를 저장할 시간 확보
    
    console.log('📤 Step 2: Sending WidgetKit Push (widget update for both Android & iOS)...');
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