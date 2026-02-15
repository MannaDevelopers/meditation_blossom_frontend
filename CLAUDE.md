# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

묵상만개 (Meditation Blossom) — a React Native mobile app (iOS + Android) that displays weekly church sermon content on home screen widgets. Sermon data is fetched from Firebase Firestore and pushed via FCM. The app is not Expo-based; it uses bare React Native with native code for both platforms.

## Build & Run Commands

```bash
# Install dependencies
yarn install

# iOS: install CocoaPods then run
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android

# Start Metro bundler separately
npx react-native start

# Lint
yarn lint

# Tests
yarn test                    # run all tests
npx jest path/to/test.ts    # run a single test
```

### Release Build (Android)

Triggered automatically via GitHub Actions when a version tag is pushed:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Local release build requires `android/app/release.keystore` and `android/app/secrets.properties` (not in git).

## Architecture

### React Native Layer (`src/`)

- **App.tsx** — Root component with React Navigation native stack (HomeScreen, EditScreen, SettingsScreen)
- **screens/HomeScreen.tsx** — Main screen. Orchestrates data loading via `useSermonData` hook, App Group sync via `useAppGroupSync`, widget sync via `useWidgetSync`, and FCM events via `useFCMListener`. Picks the most recent sermon via `compareSermon()`.
- **screens/EditScreen.tsx** — Widget customization screen (text alignment, color, size, weight, background, style)
- **screens/SettingsScreen.tsx** — Settings with data refresh, hidden developer menu (5 taps to toggle), FCM token display
- **screens/TempSermonScreen.tsx** — Dev/debug screen for browsing all sermons with pull-to-refresh
- **components/WidgetPreview.tsx** — Parses sermon text (Bible verse format) into index + content using regex, renders preview with background image
- **components/SvgIcon.tsx** — Generic SVG icon component, icons registered in `assets/icons/index.ts`
- **types/Sermon.ts** — Core data types (`Sermon`, `SermonRaw`, `SermonMetadata`), conversion functions (`fcmDataToSermon`, `firestoreDocToSermon`, `compareSermon`), Korean locale timestamp parsing
- **types/WidgetUpdateModule.ts** — TypeScript interface for native `WidgetUpdateModule` bridge module
- **types/navigation.ts** — `RootStackParamList` type for React Navigation
- **hooks/useSermonData.ts** — Sermon loading/fetching state management hook
- **hooks/useAppGroupSync.ts** — iOS App Group polling and sync hook
- **hooks/useWidgetSync.ts** — Native widget update hook
- **hooks/useFCMListener.ts** — Android FCM broadcast listener hook
- **services/sermonService.ts** — Sermon data access layer (Firestore, AsyncStorage, App Group, staleness check)
- **utils/logger.ts** — Logging utility that routes to console (dev) and Crashlytics (prod)
- **utils/normalize.ts** — JSON normalization for App Group data signature comparison
- **utils/textFormatting.ts** — Title text formatting for display
- **constants/index.ts** — App-wide constants (poll intervals, thresholds, storage keys)

### Native Bridge Modules

The app uses custom native modules bridged to React Native:

**Android** (`android/.../rnmodule/`):
- `WidgetUpdateModule.kt` — Sends sermon data to Android home screen widgets
- `NativeEventModule.kt` — Exposes as `MyEventModule` to JS; emits `ON_SERMON_UPDATE` events when FCM delivers new data
- `MyReactPackage.kt` — Registers native modules

**iOS** (`ios/`):
- `WidgetUpdateModule.swift` — Swift native module for widget updates, reads/writes App Group shared data

### Widget Implementations

**Android** (`android/.../widget/`):
- `VerseWidgetSmall.kt`, `VerseWidgetLarge.kt` — Glance AppWidget implementations for small/large widget sizes
- `VerseWidgetSmallReceiver.kt`, `VerseWidgetLargeReceiver.kt` — AppWidget receiver/provider classes

**iOS** (`ios/MeditationBlossomWidget/`):
- `MeditationBlossomWidget.swift` — WidgetKit widget implementation
- `Sermon.swift` — Swift Sermon model (mirrors the TS type)
- App Group (`group.mannachurch.meditationblossom`) shared between app and widget extension

### FCM / Push Notifications

- **iOS**: `ios/PushNotificationService/NotificationService.swift` — Notification Service Extension for processing push payloads in background/terminated state
- **Android**: FCM handling in `android/.../service/` directory
- Sermon data arrives via FCM data payload, stored in AsyncStorage (key: `fcm_sermon`), and synced to widgets

### Data Flow

1. Sermon created in Firestore (by backend crawler) → FCM push sent to devices
2. App receives FCM → stores in AsyncStorage → updates widget via native module
3. On app launch: loads from Firestore cache + AsyncStorage → picks newest → displays + syncs widget
4. iOS additionally: FCM data written to App Group by NotificationService extension → polled by HomeScreen

## Key Conventions

- **Styling**: `styled-components/native` for EditScreen; `StyleSheet.create` for other screens. Font family: Pretendard (multiple weights via `src/assets/fonts/`)
- **SVG**: Imported as React components via `react-native-svg-transformer` (configured in `metro.config.js`). Declare types in `declaration.d.ts`.
- **Navigation**: `@react-navigation/native-stack` with typed params (`RootStackParamList`)
- **Firebase**: Uses `@react-native-firebase/*` (v22.2.1) — Firestore, Messaging, Crashlytics, In-App Messaging
- **Language**: TypeScript for React Native, Kotlin for Android native, Swift/Objective-C for iOS native

## Branch & PR Policy

- **Branching strategy**: Trunk-based development — all work merges directly into `main`
- **main**: single production/development branch (the trunk)
- Feature branches: short-lived `feature/issue-##`, branched from and merged back to `main`
- PR titles must match: `[ISSUE-숫자] 설명` or `[HOTFIX] 설명` (enforced by CI)
- Squash and merge; minimum 1 approval required

## Environment Requirements

- Node.js >= 18 (recommended: 18.18.0 via nvm)
- React Native 0.78, React 19
- Android: targetSdk 35, minSdk 28
- iOS: minimum deployment target iOS 16.6
- JDK 17 (for Android builds)
- Ruby 3.0+ with CocoaPods (for iOS)
