import { Tabs } from "expo-router";
import { Text, Platform } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0D0D0D",
          borderTopColor: "#151515",
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 82 : 65,
          paddingBottom: Platform.OS === "ios" ? 26 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: "#A8FF3E",
        tabBarInactiveTintColor: "#444",
        tabBarLabelStyle: {
          fontFamily: "DMSans_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💬</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  );
}
