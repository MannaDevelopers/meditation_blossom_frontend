import { ColorSchemeName } from 'react-native';

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textTertiary: string;
  divider: string;
  dividerStrong: string;
  border: string;
  accent: string;
  infoPanelBlue: string;
  infoPanelLavender: string;
  overlay: string;
  statusBarStyle: 'dark-content' | 'light-content';
}

export const lightColors: ThemeColors = {
  background: '#F3F4F9',
  surface: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#747474',
  textMuted: '#919191',
  textTertiary: '#A59EAE',
  divider: '#E0E0E0',
  dividerStrong: '#8C8C8C',
  border: '#49454F',
  accent: '#00A8DE',
  infoPanelBlue: '#EBFAFF',
  infoPanelLavender: '#E1E5F7',
  overlay: 'rgba(0, 0, 0, 0.5)',
  statusBarStyle: 'dark-content',
};

export const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E20',
  textPrimary: '#F2F2F2',
  textSecondary: '#B5B5B5',
  textMuted: '#9A9A9A',
  textTertiary: '#9A93A5',
  divider: '#3A3A3C',
  dividerStrong: '#5A5A5C',
  border: '#B5B5B5',
  accent: '#00A8DE',
  infoPanelBlue: '#1B2A33',
  infoPanelLavender: '#242438',
  overlay: 'rgba(0, 0, 0, 0.7)',
  statusBarStyle: 'light-content',
};

export function getThemeColors(scheme: ColorSchemeName): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
