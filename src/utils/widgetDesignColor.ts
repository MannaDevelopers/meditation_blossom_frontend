export function isPresetColor(hex: string, presets: readonly string[]): boolean {
  return presets.some(preset => preset.toUpperCase() === hex.toUpperCase());
}
