import { View, TouchableOpacity, Text, StatusBar, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WidgetPreview from '../components/WidgetPreview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import SvgIcon from '../components/SvgIcon';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import {
  WidgetDesign,
  WidgetImageTransform,
  WidgetTextAlign,
  WidgetTextSize,
  WidgetTextWeight,
  DEFAULT_WIDGET_DESIGN,
} from '../types/WidgetDesign';
import {
  WIDGET_TEXT_COLOR_PRESETS,
  WIDGET_BACKGROUND_COLOR_PRESETS,
  WIDGET_TEXT_WEIGHT_FONT_FAMILY,
  WIDGET_DESIGN_STORAGE_KEY_SERMON,
  WIDGET_DESIGN_STORAGE_KEY_QT,
} from '../constants';
import { isPresetColor } from '../utils/widgetDesignColor';
import logger from '../utils/logger';
import WidgetUpdateModule from '../types/WidgetUpdateModule';

type Category = 'text' | 'background';
type TextSubTab = 'align' | 'color' | 'size' | 'weight';
type BackgroundSubTab = 'color' | 'gallery';

const CATEGORY_OPTIONS: { key: Category; label: string; icon: 'EditText' | 'EditBackground' }[] = [
  { key: 'text', label: '텍스트', icon: 'EditText' },
  { key: 'background', label: '배경', icon: 'EditBackground' },
];

const TEXT_SUB_TABS: { key: TextSubTab; label: string }[] = [
  { key: 'align', label: '정렬' },
  { key: 'color', label: '색상' },
  { key: 'size', label: '크기' },
  { key: 'weight', label: '두께' },
];

const BACKGROUND_SUB_TABS: { key: BackgroundSubTab; label: string }[] = [
  { key: 'color', label: '배경색' },
  { key: 'gallery', label: '갤러리' },
];

const ALIGN_OPTIONS: { key: WidgetTextAlign; icon: 'TextLeft' | 'TextCenter' | 'TextRight' }[] = [
  { key: 'left', icon: 'TextLeft' },
  { key: 'center', icon: 'TextCenter' },
  { key: 'right', icon: 'TextRight' },
];

const TEXT_SIZE_OPTIONS: WidgetTextSize[] = [16, 20, 24, 28];

const TEXT_WEIGHT_OPTIONS: { key: WidgetTextWeight; label: string }[] = [
  { key: 'regular', label: '보통' },
  { key: 'bold', label: '굵게' },
  { key: 'extrabold', label: '아주굵게' },
];

const DetailCircleBox = styled.TouchableOpacity<{ selected: boolean }>`
  width: 55;
  height: 55;
  justify-content: center;
  align-items: center;
  border-radius: 27px;
  border-color: ${({ selected }) => (selected ? 'white' : 'transparent')};
  border-width: ${({ selected }) => (selected ? '2px' : '0')};
`;

const DetailRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  min-height: 71;
  margin-bottom: 15;
`;

const SubMenuItemBox = styled.View`
  width: 61;
  height: 40;
  justify-content: center;
  align-items: center;
`;

const SubMenuPlainText = styled.Text`
  color: white;
  width: 61;
  font-size: 16;
  font-weight: bold;
  text-align: center;
  text-align-vertical: center;
`;

const SubMenuRow = styled.View`
  flex-direction: row;
  justify-content: center;
  gap: 12px;
  margin-bottom: 15;
`;

const CategoryRow = styled.View`
  width: 157;
  flex-direction: row;
  justify-content: space-between;
  margin-horizontal: 74;
  margin-bottom: 60;
`;

const CategoryIconBox = styled.TouchableOpacity<{ selected: boolean }>`
  width: 71;
  height: 71;
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  background-color: ${({ selected }) => (selected ? 'rgba(255,255,255,0.2)' : 'transparent')};
`;

const SwatchRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-horizontal: 30;
  margin-bottom: 15;
`;

const ColorSwatch = styled.TouchableOpacity<{ color: string; selected: boolean }>`
  width: ${({ selected }) => (selected ? '36px' : '30px')};
  height: ${({ selected }) => (selected ? '36px' : '30px')};
  border-radius: 18px;
  background-color: ${({ color }) => color};
  justify-content: center;
  align-items: center;
  border-color: white;
  border-width: ${({ selected }) => (selected ? '2px' : '0')};
`;

const CustomColorSwatch = styled.TouchableOpacity<{ selected: boolean; color?: string }>`
  width: ${({ selected }) => (selected ? '36px' : '30px')};
  height: ${({ selected }) => (selected ? '36px' : '30px')};
  border-radius: 18px;
  background-color: ${({ color }) => color || 'transparent'};
  justify-content: center;
  align-items: center;
  border-color: ${({ selected }) => (selected ? 'white' : '#888')};
  border-width: 1.5px;
  border-style: ${({ color }) => (color ? 'solid' : 'dashed')};
`;

const SwatchCheck = styled.Text`
  color: white;
  font-size: 14;
  font-weight: bold;
  text-shadow-color: rgba(0, 0, 0, 0.6);
  text-shadow-radius: 2px;
`;

const GalleryRow = styled.ScrollView.attrs({
  horizontal: true,
  showsHorizontalScrollIndicator: false,
})`
  height: 60;
  margin-bottom: 15;
`;

const GalleryRowContent = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding-horizontal: 30;
`;

const AlbumOpenButton = styled.TouchableOpacity`
  width: 60;
  height: 60;
  border-radius: 10px;
  border-width: 1.5px;
  border-color: #888888;
  border-style: dashed;
  justify-content: center;
  align-items: center;
`;

const GalleryThumbnailBox = styled.TouchableOpacity<{ selected: boolean }>`
  width: 60;
  height: 60;
  border-radius: 10px;
  border-width: 2px;
  border-color: ${({ selected }) => (selected ? '#00A8DE' : 'rgba(255,255,255,0.35)')};
  overflow: hidden;
`;

const GalleryThumbnailImage = styled.Image`
  width: 60;
  height: 60;
`;

const HeaderRow = styled.View`
  width: 100%;
  height: 26;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const HeaderRightGroup = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 20px;
`;

const HeaderResetText = styled.Text`
  color: #999999;
  font-weight: bold;
  font-size: 16;
`;

const HeaderSaveText = styled.Text`
  color: white;
  font-weight: bold;
  font-size: 20;
`;

// 콘텐츠 소스 필([ISSUE-236]) — MainTabNavigator의 "주일 말씀/매일 만나" 탭 필과 같은 톤(선택 시
// 흰 배경, 비선택은 투명)으로, 편집 대상 콘텐츠(배너형↔카드형 위젯 형태와는 독립적인 축)를 고른다.
const SourceRow = styled.View`
  flex-direction: row;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 4px;
  gap: 4px;
  margin-top: 14;
  margin-bottom: 6;
`;

const SourceButton = styled.TouchableOpacity<{ selected: boolean }>`
  flex: 1;
  align-items: center;
  padding-vertical: 8px;
  border-radius: 16px;
  background-color: ${({ selected }) => (selected ? 'white' : 'transparent')};
`;

const SourceButtonText = styled.Text<{ selected: boolean }>`
  font-size: 13;
  font-weight: bold;
  color: ${({ selected }) => (selected ? 'black' : '#8a8a8e')};
`;

const ModalBackdrop = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.6);
  justify-content: center;
  align-items: center;
`;

const ModalCard = styled.View`
  width: 260;
  background-color: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
`;

const ModalTitle = styled.Text`
  color: white;
  font-size: 16;
  font-weight: bold;
  margin-bottom: 16;
`;

const ModalInputRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-bottom: 20;
`;

const ModalHashPrefix = styled.Text`
  color: #999999;
  font-size: 16;
`;

const ModalInput = styled.TextInput`
  flex: 1;
  color: white;
  font-size: 16;
  border-bottom-width: 1px;
  border-bottom-color: #666666;
  padding-vertical: 4px;
`;

const ModalPreview = styled.View`
  width: 24;
  height: 24;
  border-radius: 12px;
  border-width: 1px;
  border-color: #666666;
`;

const ModalButtonRow = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  gap: 20px;
`;

const ModalCancelText = styled.Text`
  color: #999999;
  font-size: 16;
`;

const ModalApplyText = styled.Text<{ disabled: boolean }>`
  color: ${({ disabled }) => (disabled ? '#555555' : '#FFCD16')};
  font-size: 16;
  font-weight: bold;
`;

const HEX_INPUT_REGEX = /^[0-9A-Fa-f]{6}$/;

const CustomColorModal = ({
  visible,
  initialColor,
  onCancel,
  onApply,
}: {
  visible: boolean;
  initialColor: string;
  onCancel: () => void;
  onApply: (hex: string) => void;
}) => {
  const [text, setText] = useState(initialColor.replace('#', ''));

  const normalized = text.trim().toUpperCase();
  const isValid = HEX_INPUT_REGEX.test(normalized);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={() => setText(initialColor.replace('#', ''))}
    >
      <ModalBackdrop>
        <ModalCard>
          <ModalTitle>사용자 지정 색상</ModalTitle>
          <ModalInputRow>
            <ModalHashPrefix>#</ModalHashPrefix>
            <ModalInput
              value={text}
              onChangeText={setText}
              placeholder="000000"
              placeholderTextColor="#666666"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <ModalPreview style={{ backgroundColor: isValid ? `#${normalized}` : 'transparent' }} />
          </ModalInputRow>
          <ModalButtonRow>
            <TouchableOpacity onPress={onCancel}>
              <ModalCancelText>취소</ModalCancelText>
            </TouchableOpacity>
            <TouchableOpacity disabled={!isValid} onPress={() => onApply(`#${normalized}`)}>
              <ModalApplyText disabled={!isValid}>적용</ModalApplyText>
            </TouchableOpacity>
          </ModalButtonRow>
        </ModalCard>
      </ModalBackdrop>
    </Modal>
  );
};

const GradientSubTabLabel = ({ label }: { label: string }) => (
  <Svg width={61} height={24}>
    <Defs>
      <LinearGradient id="subTabGradient" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFCD16" />
        <Stop offset="1" stopColor="#FF7E00" />
      </LinearGradient>
    </Defs>
    <SvgText x="50%" y="17" fontSize={16} fontWeight="bold" textAnchor="middle" fill="url(#subTabGradient)">
      {label}
    </SvgText>
  </Svg>
);

const ColorSwatchRow = ({
  currentColor,
  presets,
  onSelectPreset,
  onOpenCustom,
}: {
  currentColor: string;
  presets: readonly string[];
  onSelectPreset: (hex: string) => void;
  onOpenCustom: () => void;
}) => {
  const customSelected = !isPresetColor(currentColor, presets);
  return (
    <SwatchRow>
      {presets.map(hex => {
        const selected = hex.toUpperCase() === currentColor.toUpperCase();
        return (
          <ColorSwatch key={hex} color={hex} selected={selected} onPress={() => onSelectPreset(hex)}>
            {selected && <SwatchCheck>✓</SwatchCheck>}
          </ColorSwatch>
        );
      })}
      <CustomColorSwatch
        selected={customSelected}
        color={customSelected ? currentColor : undefined}
        onPress={onOpenCustom}
      >
        {customSelected ? <SwatchCheck>✓</SwatchCheck> : <Text style={{ color: 'white', fontSize: 16 }}>+</Text>}
      </CustomColorSwatch>
    </SwatchRow>
  );
};

type Props = NativeStackScreenProps<RootStackParamList, 'EditScreen'>;

type WidgetSource = 'sermon' | 'qt';

const DEFAULT_DESIGNS_BY_SOURCE: Record<WidgetSource, WidgetDesign> = {
  sermon: DEFAULT_WIDGET_DESIGN,
  qt: DEFAULT_WIDGET_DESIGN,
};

const WIDGET_DESIGN_STORAGE_KEY_BY_SOURCE: Record<WidgetSource, string> = {
  sermon: WIDGET_DESIGN_STORAGE_KEY_SERMON,
  qt: WIDGET_DESIGN_STORAGE_KEY_QT,
};

type RecentGalleryImage = { uri: string; transform: WidgetImageTransform };

// 갤러리에서 고른 배경 사진은 최근 것부터 이 개수만큼만 유지한다 — 다른 옵션 탭을 오가거나
// 새 사진을 골라도 이전에 적용했던 사진들을 다시 시스템 사진 선택기 없이 바로 고를 수 있게 한다.
const MAX_RECENT_GALLERY_IMAGES = 5;

const EditScreen = ({ navigation, route }: Props) => {
  const sermon = route.params?.sermon;
  const qt = route.params?.qt;

  // [ISSUE-236] 주일 말씀/QT 디자인을 소스별로 독립 편집·저장하기 위해 draft/saved 상태를 소스별
  // 레코드로 보관한다. activeSource 전환 시에도 각 소스의 draft는 그대로 유지된다.
  const [savedDesigns, setSavedDesigns] = useState<Record<WidgetSource, WidgetDesign>>(DEFAULT_DESIGNS_BY_SOURCE);
  const [draftDesigns, setDraftDesigns] = useState<Record<WidgetSource, WidgetDesign>>(DEFAULT_DESIGNS_BY_SOURCE);
  const [activeSource, setActiveSource] = useState<WidgetSource>(route.params?.initialSource ?? 'sermon');
  const draftDesign = draftDesigns[activeSource];
  const activeContent = activeSource === 'sermon' ? sermon : qt;

  const [category, setCategory] = useState<Category>('text');
  const [textSubTab, setTextSubTab] = useState<TextSubTab>('align');
  const [backgroundSubTab, setBackgroundSubTab] = useState<BackgroundSubTab>('color');
  const [customColorTarget, setCustomColorTarget] = useState<'text' | 'background' | null>(null);
  const [recentGalleryImages, setRecentGalleryImages] = useState<RecentGalleryImage[]>([]);

  const activeSubTab = category === 'text' ? textSubTab : backgroundSubTab;

  // 진입 시 마지막으로 저장했던 두 소스의 디자인을 각각 불러온다 — 없으면(최초 진입) 기본값을
  // 그대로 유지한다. "초기화" 버튼(handleReset)은 이 로드와 무관하게 활성 소스만 항상
  // DEFAULT_WIDGET_DESIGN으로 되돌린다.
  useEffect(() => {
    (async () => {
      try {
        const [sermonRaw, qtRaw] = await Promise.all([
          AsyncStorage.getItem(WIDGET_DESIGN_STORAGE_KEY_SERMON),
          AsyncStorage.getItem(WIDGET_DESIGN_STORAGE_KEY_QT),
        ]);
        const loaded: Partial<Record<WidgetSource, WidgetDesign>> = {};
        if (sermonRaw) loaded.sermon = JSON.parse(sermonRaw) as WidgetDesign;
        if (qtRaw) loaded.qt = JSON.parse(qtRaw) as WidgetDesign;
        if (Object.keys(loaded).length === 0) return;
        setSavedDesigns(prev => ({ ...prev, ...loaded }));
        setDraftDesigns(prev => ({ ...prev, ...loaded }));
      } catch (e) {
        logger.error('EditScreen: 저장된 위젯 디자인 로드 실패', e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 마운트 시 1회만 로드

  const hasUnsavedChanges = useMemo(
    () =>
      (['sermon', 'qt'] as const).some(
        source => JSON.stringify(draftDesigns[source]) !== JSON.stringify(savedDesigns[source]),
      ),
    [draftDesigns, savedDesigns],
  );

  // handleSave에서 setSavedDesign 직후 곧바로 navigation.goBack()을 호출하면, 아직 리렌더 전이라
  // hasUnsavedChanges가 저장 이전 값(true)인 채로 이 가드에 걸려 "저장했는데도" 이탈 확인 다이얼로그가
  // 뜬다. 저장으로 인한 이탈인지는 렌더 타이밍에 의존하지 않는 ref로 판별해 우회한다.
  const justSavedRef = useRef(false);

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    if (justSavedRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(
      '변경사항을 저장하지 않았습니다',
      '지금 나가면 편집한 내용이 사라집니다.',
      [
        { text: '계속 편집', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  const handleReset = () => {
    Alert.alert(
      '기본값으로 되돌릴까요?',
      '지금까지 편집한 내용이 모두 사라집니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '되돌리기',
          style: 'destructive',
          onPress: () => setDraftDesigns(prev => ({ ...prev, [activeSource]: DEFAULT_WIDGET_DESIGN })),
        },
      ],
    );
  };

  // 저장 자체는 즉시 완료되는 로컬 상태 변경이라 네이티브 동기화를 기다리지 않고 바로 나간다 —
  // 실패해도 사용자를 화면에 붙잡아두지 않고 logger로만 기록한다(콘텐츠 동기화와 동일한 방식).
  // 소스별로 별도 브릿지 메서드를 쓴다([ISSUE-236]) — 기존 sermon/qt 콘텐츠 동기화와 동일한 컨벤션.
  const syncWidgetDesignToNative = async (source: WidgetSource, design: WidgetDesign) => {
    try {
      if (source === 'sermon') {
        if (!WidgetUpdateModule?.onWidgetDesignUpdated) {
          logger.error('WidgetUpdateModule.onWidgetDesignUpdated is not available');
          return;
        }
        await WidgetUpdateModule.onWidgetDesignUpdated(JSON.stringify(design));
      } else {
        if (!WidgetUpdateModule?.onQtWidgetDesignUpdated) {
          logger.error('WidgetUpdateModule.onQtWidgetDesignUpdated is not available');
          return;
        }
        await WidgetUpdateModule.onQtWidgetDesignUpdated(JSON.stringify(design));
      }
    } catch (e) {
      logger.error('EditScreen: 위젯 디자인 저장 실패', e);
    }
  };

  // 네이티브에는 위젯 렌더링용으로만 저장되고 RN에서 다시 읽어올 방법이 없어, 편집 화면
  // 자체가 "마지막으로 저장한 디자인"을 기억하도록 AsyncStorage에도 같이 캐시한다([#235]).
  const cacheWidgetDesignLocally = async (source: WidgetSource, design: WidgetDesign) => {
    try {
      await AsyncStorage.setItem(WIDGET_DESIGN_STORAGE_KEY_BY_SOURCE[source], JSON.stringify(design));
    } catch (e) {
      logger.error('EditScreen: 위젯 디자인 로컬 캐시 실패', e);
    }
  };

  // 두 소스 중 편집하지 않은 쪽이 조용히 날아가면 안 되므로, draft가 saved와 달라진 소스만
  // 골라 커밋한다([ISSUE-236]) — 편집 안 한 소스는 그대로 유지.
  const handleSave = () => {
    justSavedRef.current = true;
    (['sermon', 'qt'] as const).forEach(source => {
      if (JSON.stringify(draftDesigns[source]) === JSON.stringify(savedDesigns[source])) return;
      const design = draftDesigns[source];
      setSavedDesigns(prev => ({ ...prev, [source]: design }));
      syncWidgetDesignToNative(source, design);
      cacheWidgetDesignLocally(source, design);
    });
    navigation.goBack();
  };

  const updateText = (patch: Partial<WidgetDesign['text']>) =>
    setDraftDesigns(prev => ({
      ...prev,
      [activeSource]: { ...prev[activeSource], text: { ...prev[activeSource].text, ...patch } },
    }));

  const updateBackgroundColor = (hex: string) =>
    setDraftDesigns(prev => ({
      ...prev,
      [activeSource]: { ...prev[activeSource], background: { type: 'color', value: hex } },
    }));

  // 최근 적용한 갤러리 사진 목록에 upsert — 같은 사진을 다시 고르면 기존 항목을 빼고
  // 맨 앞으로 옮기며, 최대 개수를 넘으면 가장 오래된 것부터 잘라낸다.
  const upsertRecentGalleryImage = (uri: string, transform: WidgetImageTransform) => {
    setRecentGalleryImages(prev =>
      [{ uri, transform }, ...prev.filter(item => item.uri !== uri)].slice(0, MAX_RECENT_GALLERY_IMAGES),
    );
  };

  const openImageCropScreen = (imageUri: string) => {
    const existingTransform =
      draftDesign.background.type === 'gallery' && draftDesign.background.value === imageUri
        ? draftDesign.background.imageTransform
        : recentGalleryImages.find(item => item.uri === imageUri)?.transform;
    // 크롭 결과는 route.params(navigate + merge)가 아니라 콜백으로 직접 돌려받는다.
    // params로 결과를 실어 돌아오면 React Navigation이 이 EditScreen을 새 인스턴스로
    // 취급할 수 있어(merge 동작이 상황에 따라 기존 params를 완전히 대체) sermon 같은
    // 나머지 params가 사라지고 본문이 안 보이게 되는 문제가 있었다. 콜백은 지금 이
    // EditScreen 인스턴스의 클로저를 그대로 쓰므로 그럴 일이 없다.
    navigation.navigate('ImageCropScreen', {
      imageUri,
      initialTransform: existingTransform,
      onApply: transform => {
        setDraftDesigns(prev => ({
          ...prev,
          [activeSource]: {
            ...prev[activeSource],
            background: { type: 'gallery', value: imageUri, imageTransform: transform },
          },
        }));
        upsertRecentGalleryImage(imageUri, transform);
      },
    });
  };

  const handleOpenAlbum = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel) return;
      if (result.errorCode) {
        logger.error('EditScreen: 이미지 피커 오류', result.errorCode, result.errorMessage);
        Alert.alert('오류', '사진을 불러오지 못했습니다. 다시 시도해주세요.');
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      openImageCropScreen(uri);
    } catch (e) {
      logger.error('EditScreen: 이미지 피커 실행 실패', e);
    }
  };

  const renderDetailTab = () => {
    if (category === 'text') {
      switch (textSubTab) {
        case 'align':
          return (
            <DetailRow>
              {ALIGN_OPTIONS.map(opt => (
                <DetailCircleBox
                  key={opt.key}
                  selected={draftDesign.text.align === opt.key}
                  onPress={() => updateText({ align: opt.key })}
                >
                  <SvgIcon name={opt.icon} size={25} />
                </DetailCircleBox>
              ))}
            </DetailRow>
          );
        case 'color':
          return (
            <ColorSwatchRow
              currentColor={draftDesign.text.color}
              presets={WIDGET_TEXT_COLOR_PRESETS}
              onSelectPreset={hex => updateText({ color: hex })}
              onOpenCustom={() => setCustomColorTarget('text')}
            />
          );
        case 'size':
          return (
            <DetailRow>
              {TEXT_SIZE_OPTIONS.map(size => (
                <DetailCircleBox
                  key={size}
                  selected={draftDesign.text.size === size}
                  onPress={() => updateText({ size })}
                >
                  <Text
                    allowFontScaling={false}
                    style={{ fontSize: Math.min(size, 30), fontFamily: 'Pretendard-Bold', color: 'white' }}
                  >
                    가
                  </Text>
                </DetailCircleBox>
              ))}
            </DetailRow>
          );
        case 'weight':
          return (
            <DetailRow>
              {TEXT_WEIGHT_OPTIONS.map(opt => (
                <DetailCircleBox
                  key={opt.key}
                  selected={draftDesign.text.weight === opt.key}
                  onPress={() => updateText({ weight: opt.key })}
                >
                  <Text
                    allowFontScaling={false}
                    style={{ fontSize: 20, fontFamily: WIDGET_TEXT_WEIGHT_FONT_FAMILY[opt.key], color: 'white' }}
                  >
                    가
                  </Text>
                </DetailCircleBox>
              ))}
            </DetailRow>
          );
        default:
          return null;
      }
    }

    switch (backgroundSubTab) {
      case 'color':
        return (
          <ColorSwatchRow
            currentColor={draftDesign.background.type === 'color' ? draftDesign.background.value : '#FFFFFF'}
            presets={WIDGET_BACKGROUND_COLOR_PRESETS}
            onSelectPreset={hex => updateBackgroundColor(hex)}
            onOpenCustom={() => setCustomColorTarget('background')}
          />
        );
      case 'gallery': {
        const appliedUri = draftDesign.background.type === 'gallery' ? draftDesign.background.value : null;
        return (
          <GalleryRow>
            <GalleryRowContent>
              <AlbumOpenButton onPress={handleOpenAlbum}>
                <Text style={{ color: 'white', fontSize: 24 }}>+</Text>
              </AlbumOpenButton>
              {recentGalleryImages.map(({ uri, transform }) => {
                const selected = uri === appliedUri;
                return (
                  <GalleryThumbnailBox
                    key={uri}
                    selected={selected}
                    onPress={() =>
                      // 이미 적용 중인 사진을 다시 누르면 위치/줌을 조정할 수 있도록 크롭 화면을 열고,
                      // 다른 최근 사진을 누르면 마지막으로 저장했던 위치 그대로 바로 적용한다.
                      selected
                        ? openImageCropScreen(uri)
                        : setDraftDesigns(prev => ({
                            ...prev,
                            [activeSource]: {
                              ...prev[activeSource],
                              background: { type: 'gallery', value: uri, imageTransform: transform },
                            },
                          }))
                    }
                  >
                    <GalleryThumbnailImage source={{ uri }} />
                  </GalleryThumbnailBox>
                );
              })}
            </GalleryRowContent>
          </GalleryRow>
        );
      }
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* 헤더(뒤로가기/초기화/저장)는 스크롤 영역 밖에 고정 — 화면이 작아 아래 내용이
          다 안 들어와도 항상 접근 가능해야 한다. */}
      <View style={{ marginHorizontal: 35, marginTop: 16 }}>
        <HeaderRow>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <SvgIcon name="BackButton" size={20} />
          </TouchableOpacity>
          <HeaderRightGroup>
            <TouchableOpacity onPress={handleReset}>
              <HeaderResetText>초기화</HeaderResetText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave}>
              <HeaderSaveText>저장</HeaderSaveText>
            </TouchableOpacity>
          </HeaderRightGroup>
        </HeaderRow>

        {/* 콘텐츠 소스 필([ISSUE-236]) — 이 화면에서 지금 편집 중인 콘텐츠(주일 말씀/매일 만나)를
            고른다. 전환해도 각 소스의 draft는 draftDesigns에 그대로 남아있어 편집 내용이 유지된다. */}
        <SourceRow>
          <SourceButton selected={activeSource === 'sermon'} onPress={() => setActiveSource('sermon')}>
            <SourceButtonText selected={activeSource === 'sermon'}>주일 말씀</SourceButtonText>
          </SourceButton>
          <SourceButton selected={activeSource === 'qt'} onPress={() => setActiveSource('qt')}>
            <SourceButtonText selected={activeSource === 'qt'}>매일 만나</SourceButtonText>
          </SourceButton>
        </SourceRow>
      </View>

      {/* 미리보기 + 편집 탭들 — 화면이 작은 기기에서는 아래 탭들이 잘리지 않도록 스크롤 가능해야 한다.
          충분히 큰 화면에서는 flexGrow+center로 스크롤 없이 그대로 가운데 정렬되어 보인다. */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 35,
          paddingVertical: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: 'transparent', marginVertical: 15, borderRadius: 20 }}>
          <WidgetPreview title={activeContent?.title} content={activeContent?.content} design={draftDesign} />
        </View>

        {/* 3번 탭: 2번 탭 선택에 따른 세부 옵션, 미리보기 바로 아래 */}
        {renderDetailTab()}

        {/* 2번 탭: 1번 탭 선택에 따른 하위 그룹 메뉴 */}
        <SubMenuRow>
          {(category === 'text' ? TEXT_SUB_TABS : BACKGROUND_SUB_TABS).map(item => {
            const selected = activeSubTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() =>
                  category === 'text'
                    ? setTextSubTab(item.key as TextSubTab)
                    : setBackgroundSubTab(item.key as BackgroundSubTab)
                }
              >
                <SubMenuItemBox>
                  {selected ? <GradientSubTabLabel label={item.label} /> : <SubMenuPlainText>{item.label}</SubMenuPlainText>}
                </SubMenuItemBox>
              </TouchableOpacity>
            );
          })}
        </SubMenuRow>

        {/* 1번 탭: 최상위 카테고리(텍스트/배경), 화면 맨 아래 */}
        <CategoryRow>
          {CATEGORY_OPTIONS.map(opt => (
            <CategoryIconBox key={opt.key} selected={category === opt.key} onPress={() => setCategory(opt.key)}>
              <SvgIcon name={opt.icon} size={35} />
            </CategoryIconBox>
          ))}
        </CategoryRow>
      </ScrollView>

      <CustomColorModal
        visible={customColorTarget !== null}
        initialColor={
          customColorTarget === 'background'
            ? draftDesign.background.type === 'color'
              ? draftDesign.background.value
              : '#FFFFFF'
            : draftDesign.text.color
        }
        onCancel={() => setCustomColorTarget(null)}
        onApply={hex => {
          if (customColorTarget === 'text') updateText({ color: hex });
          if (customColorTarget === 'background') updateBackgroundColor(hex);
          setCustomColorTarget(null);
        }}
      />
    </SafeAreaView>
  );
};

export default EditScreen;
