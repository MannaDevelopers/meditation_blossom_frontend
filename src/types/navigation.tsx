import { Sermon, SermonMetadata } from "./Sermon";
export type RootStackParamList = {
    HomeScreen: undefined;
    EditScreen: { sermon?: Sermon };
    SettingsScreen: {
      setSermons: (sermons: Sermon[]) => void;
      setLatestDate: (date: string | null) => void;
      setMetadata: (metadata: SermonMetadata) => void;
      onRefresh: () => void;
    };
    // Add other screens here as needed
  };