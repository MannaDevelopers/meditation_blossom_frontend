import { useColorScheme } from 'react-native';
import { getThemeColors, ThemeColors } from '../theme/colors';

export interface AppTheme {
  colors: ThemeColors;
  isDark: boolean;
}

export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  return {
    colors: getThemeColors(scheme),
    isDark: scheme === 'dark',
  };
}
