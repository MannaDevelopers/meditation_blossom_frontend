import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { ThemeColors } from '../theme/colors';

interface ForceUpdateModalProps {
  visible: boolean;
  message: string;
  onPressUpdate: () => void;
}

function ForceUpdateModal({
  visible,
  message,
  onPressUpdate,
}: ForceUpdateModalProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>업데이트 필요</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onPressUpdate}>
            <Text style={styles.buttonText}>업데이트</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 24,
      marginHorizontal: 32,
      alignItems: 'center',
    },
    title: {
      fontFamily: 'Pretendard-Bold',
      fontSize: 20,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    message: {
      fontFamily: 'Pretendard-Regular',
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    button: {
      backgroundColor: '#4A90D9',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 48,
    },
    buttonText: {
      fontFamily: 'Pretendard-SemiBold',
      fontSize: 16,
      color: '#FFFFFF',
    },
  });

export default ForceUpdateModal;
