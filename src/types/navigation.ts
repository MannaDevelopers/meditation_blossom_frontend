import { Sermon } from "./Sermon";
export type RootStackParamList = {
  MainTabs: undefined;
  EditScreen: { sermon?: Sermon };
  SettingsScreen: {
    onRefresh: () => void;
  };
};