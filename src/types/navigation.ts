import { Sermon } from "./Sermon";
import { WidgetImageTransform } from "./WidgetDesign";

export type RootStackParamList = {
  MainTabs: undefined;
  EditScreen: { sermon?: Sermon };
  SettingsScreen: undefined;
  ImageCropScreen: {
    imageUri: string;
    initialTransform?: WidgetImageTransform;
    // 크롭 화면은 EditScreen의 기존 인스턴스를 그대로 유지한 채(navigation.goBack) 결과만
    // 콜백으로 돌려준다. route.params로 결과를 실어 되돌아가면(navigate + merge) 화면
    // 인스턴스가 바뀔 수 있어 sermon 등 나머지 params가 유실될 위험이 있어 피한다.
    onApply: (transform: WidgetImageTransform) => void;
  };
};