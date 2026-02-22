import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginHorizontal: 32,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#555555',
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
