import { View, TouchableOpacity, Text, StatusBar, Modal, TextInput, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import WidgetPreview from '../components/WidgetPreview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import SvgIcon from '../components/SvgIcon';
import React, { useMemo, useState } from 'react';
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
} from '../constants';
import { isPresetColor } from '../utils/widgetDesignColor';
import logger from '../utils/logger';

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
  width: 305;
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

type RecentGalleryImage = { uri: string; transform: WidgetImageTransform };

// 갤러리에서 고른 배경 사진은 최근 것부터 이 개수만큼만 유지한다 — 다른 옵션 탭을 오가거나
// 새 사진을 골라도 이전에 적용했던 사진들을 다시 시스템 사진 선택기 없이 바로 고를 수 있게 한다.
const MAX_RECENT_GALLERY_IMAGES = 5;

const EditScreen = ({ navigation, route }: Props) => {
  const sermon = route.params?.sermon;

  const [savedDesign, setSavedDesign] = useState<WidgetDesign>(DEFAULT_WIDGET_DESIGN);
  const [draftDesign, setDraftDesign] = useState<WidgetDesign>(DEFAULT_WIDGET_DESIGN);
  const [category, setCategory] = useState<Category>('text');
  const [textSubTab, setTextSubTab] = useState<TextSubTab>('align');
  const [backgroundSubTab, setBackgroundSubTab] = useState<BackgroundSubTab>('color');
  const [customColorTarget, setCustomColorTarget] = useState<'text' | 'background' | null>(null);
  const [recentGalleryImages, setRecentGalleryImages] = useState<RecentGalleryImage[]>([]);

  const activeSubTab = category === 'text' ? textSubTab : backgroundSubTab;

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftDesign) !== JSON.stringify(savedDesign),
    [draftDesign, savedDesign],
  );

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
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
        { text: '되돌리기', style: 'destructive', onPress: () => setDraftDesign(DEFAULT_WIDGET_DESIGN) },
      ],
    );
  };

  const handleSave = () => {
    setSavedDesign(draftDesign);
    navigation.goBack();
  };

  const updateText = (patch: Partial<WidgetDesign['text']>) =>
    setDraftDesign(prev => ({ ...prev, text: { ...prev.text, ...patch } }));

  const updateBackgroundColor = (hex: string) =>
    setDraftDesign(prev => ({ ...prev, background: { type: 'color', value: hex } }));

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
        setDraftDesign(prev => ({
          ...prev,
          background: { type: 'gallery', value: imageUri, imageTransform: transform },
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
                        : setDraftDesign(prev => ({
                            ...prev,
                            background: { type: 'gallery', value: uri, imageTransform: transform },
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
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          marginHorizontal: 35,
          marginVertical: 60,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
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

        <View style={{ backgroundColor: 'transparent', marginVertical: 105, borderRadius: 20 }}>
          <WidgetPreview title={sermon?.title} content={sermon?.content} design={draftDesign} />
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
      </View>

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
    </View>
  );
};

export default EditScreen;
