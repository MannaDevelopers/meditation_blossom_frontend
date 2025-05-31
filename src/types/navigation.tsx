import { Sermon } from "./Sermon";
export type RootStackParamList = {
    HomeScreen: undefined;
    EditScreen: { sermon?: Sermon };
    SettingsScreen: undefined;
    // Add other screens here as needed
  };