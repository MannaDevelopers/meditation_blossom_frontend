# 만개하다

## PR 및 브랜치 정책

### PR 정책
- PR 제목은 `[SCRUM-n]` 또는 `[HOTFIX]`로 시작해야 합니다.
- PR 템플릿을 사용하여 작업 내용을 명확히 작성해야 합니다.
- PR은 최소 1명의 승인이 필요합니다.
- Squash and Merge 방식으로 병합합니다.

### 브랜치 정책 (Git Flow)
- `main`: 프로덕션 브랜치
- `hotfix`: 긴급 버그 수정 브랜치
- `dev`: 개발 브랜치
- `feature/task_id`: 기능 개발 브랜치 (예: feature/SCRUM-12)

## 안드로이드 빌드 가이드

### 1. GitHub Actions를 통한 자동 빌드
릴리스 빌드는 GitHub Actions를 통해 자동으로 생성됩니다.

#### 빌드 방법
1. 태그 생성 및 푸시
```bash
git tag v1.0.0  # 버전 형식: v{major}.{minor}.{patch}
git push origin v1.0.0
```
2. GitHub Actions가 자동으로 실행되어 릴리스를 생성합니다.
3. 생성된 릴리스는 GitHub 저장소의 Releases 페이지에서 확인할 수 있습니다.

### 2. 로컬 환경에서 빌드
로컬에서 직접 빌드하기 위해서는 다음 파일들이 필요합니다:

#### 필요한 파일
- `android/app/release.keystore`
- `android/app/secrets.properties`

> 💡 위 파일들은 보안상의 이유로 git에 포함되어 있지 않습니다.
> Discord의 `group-android-widget` 채널에서 파일을 받을 수 있습니다.

#### 설정 방법

1. **release.keystore 파일 생성**
```bash
# Discord에서 받은 BASE64_SECRETS_STRING을 사용하여 생성
echo "$BASE64_SECRETS_STRING" | base64 --decode > android/app/release.keystore
```

2. **secrets.properties 파일 생성**
```properties
# android/app/secrets.properties 파일 생성 후 아래 내용 입력
STORE_FILE=release.keystore
STORE_PASSWORD=<비밀번호>
KEY_ALIAS=<키 별칭>
KEY_PASSWORD=<키 비밀번호>
```

> ⚠️ 실제 값은 Discord 채널에서 확인하세요.

#### 빌드 실행
```bash
# 프로젝트 루트 디렉토리에서
cd android
./gradlew bundleRelease  # AAB 파일 생성
# 또는
./gradlew assembleRelease  # APK 파일 생성
```

생성된 파일 위치:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

### 3. 앱 버전 관리
앱의 버전 정보는 `android/gradle/libs.versions.toml` 파일에서 관리합니다.

- `appVersionName`: 사용자에게 보이는 버전 (예: "1.0.2")
- `appVersionCode`: 내부 빌드 번호 (예: "7")

로컬 빌드 시에는 이 파일에 설정된 값이 사용됩니다.

> **CI 빌드 참고**: GitHub Actions를 통한 릴리스 시에는:
> - `versionName`: Git Tag에서 추출 (예: `v1.0.0` -> `1.0.0`)
> - `versionCode`: GitHub Run Number를 기반으로 자동 생성 (자동 증가)

#### iOS와 버전 공유 (제안)
Android와 iOS의 버전을 일치시키기 위해 다음 방법을 제안합니다:

1. **`package.json`을 기준(Single Source of Truth)으로 사용**:
   - `package.json`의 `version` 필드를 마스터 버전으로 관리합니다.
2. **버전 동기화 스크립트/도구 사용**:
   - `react-native-version` 같은 라이브러리를 사용하여 `npm version` 명령 실행 시 Android와 iOS 프로젝트 파일의 버전을 자동으로 업데이트합니다.
   - 또는 Fastlane 같은 배포 도구를 사용하여 배포 파이프라인에서 버전을 동기화할 수 있습니다.

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

>**Note**: Make sure you have completed the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) instructions till "Creating a new application" step, before proceeding.

## Step 1: Start the Metro Server

First, you will need to start **Metro**, the JavaScript _bundler_ that ships _with_ React Native.

To start Metro, run the following command from the _root_ of your React Native project:

```bash
# using npm
# npm start

# npm 대신 yarn 을 쓰는걸 권장합니다.
yarn start
```

## Step 2: Start your Application

Let Metro Bundler run in its _own_ terminal. Open a _new_ terminal from the _root_ of your React Native project. Run the following command to start your _Android_ or _iOS_ app:

### For Android

```bash
# using npm
# npm run android

# npm 대신 yarn 을 쓰는걸 권장합니다.
yarn android
```

### For iOS

```bash
# using npm
# npm run ios

# npm 대신 yarn 을 쓰는걸 권장합니다.
yarn ios
```

If everything is set up _correctly_, you should see your new app running in your _Android Emulator_ or _iOS Simulator_ shortly provided you have set up your emulator/simulator correctly.

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

## Step 3: Modifying your App

Now that you have successfully run the app, let's modify it.

1. Open `App.tsx` in your text editor of choice and edit some lines.
2. For **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Developer Menu** (<kbd>Ctrl</kbd> + <kbd>M</kbd> (on Window and Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (on macOS)) to see your changes!

   For **iOS**: Hit <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in your iOS Simulator to reload the app and see your changes!

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [Introduction to React Native](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you can't get this to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
