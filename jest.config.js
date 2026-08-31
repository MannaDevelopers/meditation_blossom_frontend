module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    // react-native 관련 모든 패키지를 변환 대상에 포함 (치트키)
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@react-navigation|react-native-.*|@react-native-.*|react-native-tab-view)/',
  ],
  // 이슈 처리 하네스가 생성하는 독립 워크트리(자체 node_modules 보유)가
  // 테스트 glob에 잡혀 충돌하는 것을 방지
  testPathIgnorePatterns: ['/node_modules/', '/.worktrees/', '/.claude/worktrees/'],
  modulePathIgnorePatterns: ['/.worktrees/', '/.claude/worktrees/'],
  // 테스트 종료 후 남아있는 비동기 작업으로 인한 에러 방지
  fakeTimers: {
    enableGlobally: true,
  },
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/',
    '<rootDir>/.worktrees/',
    '<rootDir>/vendor/',
  ],
};