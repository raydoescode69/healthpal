import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: "Nyra",
    slug: "healthpal",
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    },
  };
};
