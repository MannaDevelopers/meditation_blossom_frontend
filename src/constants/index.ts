/** Interval (ms) for polling iOS App Group data for background FCM updates */
export const APP_GROUP_POLL_INTERVAL_MS = 5000;
/** Delay (ms) before accessing native bridge after iOS app launch */
export const BRIDGE_INIT_DELAY_MS = 100;
/** Days after which local sermon data is considered stale and re-fetched from server */
export const STALE_DATA_THRESHOLD_DAYS = 7;
/** UserDefaults / App Group key for the currently displayed sermon */
export const APP_GROUP_DISPLAY_SERMON_KEY = 'displaySermon';
