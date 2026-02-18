import { Stack } from "expo-router";
import { useThemeStore } from "../../store/useThemeStore";
import { THEMES } from "../../lib/theme";

export default function MainLayout() {
  const mode = useThemeStore((s) => s.mode);
  const colors = THEMES[mode];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.pageBg },
        animation: "fade",
      }}
    />
  );
}
