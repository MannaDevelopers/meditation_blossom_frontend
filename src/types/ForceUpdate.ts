export interface ForceUpdateConfig {
  force_update_enabled: boolean;
  android_min_version: string;
  ios_min_version: string;
  force_update_message: string;
  android_store_url: string;
  ios_store_url: string;
}

/**
 * Semver 비교. a > b → 양수, a < b → 음수, a === b → 0.
 * 세그먼트가 부족하면 0으로 채움 (예: "1.0" === "1.0.0").
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

/**
 * 강제 업데이트 필요 여부 판단.
 * enabled가 false이면 항상 false 반환.
 */
export function needsForceUpdate(
  currentVersion: string,
  minimumVersion: string,
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  return compareVersions(currentVersion, minimumVersion) < 0;
}
