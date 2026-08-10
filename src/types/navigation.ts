import { Sermon } from "./Sermon";
import { WidgetImageTransform } from "./WidgetDesign";

export type ImageCropResult = {
  uri: string;
  transform: WidgetImageTransform;
};

export type RootStackParamList = {
  MainTabs: undefined;
  EditScreen: { sermon?: Sermon; cropResult?: ImageCropResult };
  SettingsScreen: undefined;
  ImageCropScreen: { imageUri: string; initialTransform?: WidgetImageTransform };
};