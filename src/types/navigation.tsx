import { Sermon } from "./Sermon";
export type RootStackParamList = {
  HomeScreen: undefined;
  EditScreen: { sermon?: Sermon };
  SettingsScreen: {
    onRefresh: () => void;
  };
  // Add other screens here as needed
};