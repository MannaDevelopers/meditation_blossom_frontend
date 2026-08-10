export function isPresetColor(hex: string, presets: readonly string[]): boolean {
  return presets.some(preset => preset.toUpperCase() === hex.toUpperCase());
}

interface Hsl {
  h: number; // 0~360
  s: number; // 0~100
  l: number; // 0~100
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      default:
        h = (rNorm - gNorm) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  if (sNorm === 0) {
    const gray = Math.round(lNorm * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function getHexLightness(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b).l;
}

// 카드형(Small) 위젯의 이중 레이어 재해석([#169] 3.7절) — 배경색의 제목 영역을
// "같은 색조·채도, 더 밝은 명도"로 계산한다. 95% 상한 clamp는 이미 밝은 색(흰색 등)이
// 눈에 띄게 어두워지지 않도록 하는 안전장치.
export function lightenHexColor(hex: string, deltaLightnessPoints: number, maxLightness = 95): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const nextL = Math.min(l + deltaLightnessPoints, maxLightness);
  const { r: nr, g: ng, b: nb } = hslToRgb(h, s, nextL);
  return rgbToHex(nr, ng, nb);
}
