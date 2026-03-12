import React from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SvgIcon from '../components/SvgIcon';
import { RootStackParamList } from '../types/navigation';
import logger from '../utils/logger';

const DAILY_MANNA_YOUTUBE_URL = 'https://www.youtube.com/@mannachurch';

const DailyMannaScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const openYoutube = () => {
    Linking.openURL(DAILY_MANNA_YOUTUBE_URL).catch(e =>
      logger.error('DailyMannaScreen: YouTube 링크 열기 실패', e),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../assets/image/20250416_meditation_icon.png')}
            style={styles.icon}
          />
          <Text style={styles.appTitle}>묵상만개</Text>
          <TouchableOpacity onPress={openYoutube} style={styles.youtubeButton}>
            <SvgIcon name="YoutubeButton" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('SettingsScreen', { onRefresh: () => {} })}
            style={styles.settingsButton}
          >
            <SvgIcon name="SettingButton" size={20} color="black" />
          </TouchableOpacity>
        </View>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>매일만나</Text>
          <Text style={styles.placeholderSubText}>준비 중입니다</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 35,
    marginVertical: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    width: 305,
    height: 30,
    marginBottom: 35,
    alignItems: 'center',
  },
  icon: {
    backgroundColor: 'transparent',
    borderRadius: 15,
    width: 20,
    height: 20,
  },
  appTitle: {
    color: '#49454F',
    fontSize: 20,
    fontFamily: 'Pretendard-Medium',
    marginLeft: 8,
  },
  youtubeButton: {
    marginLeft: 'auto',
    padding: 2,
  },
  settingsButton: {
    marginLeft: 8,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#49454F',
    fontSize: 20,
    fontFamily: 'Pretendard-Medium',
  },
  placeholderSubText: {
    color: '#A59EAE',
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    marginTop: 8,
  },
});

export default DailyMannaScreen;
