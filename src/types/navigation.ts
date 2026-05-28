import { Sermon } from "./Sermon";
export type RootStackParamList = {
  MainTabs: { tab?: string } | undefined;
  EditScreen: { sermon?: Sermon };
  SettingsScreen: undefined;
};