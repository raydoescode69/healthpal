import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/useAuthStore";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, logout } = useAuthStore();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    logout();
    router.replace("/(auth)");
  };

  return (
    <View className="flex-1 bg-brand-dark px-6 pt-16">
      <Text className="text-2xl text-white font-sora-bold mb-8">Profile</Text>

      {profile && (
        <View className="gap-4 mb-10">
          {[
            { label: "Name", value: profile.name },
            { label: "Age", value: `${profile.age} years` },
            { label: "Weight", value: `${profile.weight} kg` },
            { label: "Height", value: `${profile.height} cm` },
            { label: "Goal", value: profile.goal },
            { label: "Diet", value: profile.diet_type },
          ].map((item) => (
            <View
              key={item.label}
              className="flex-row justify-between bg-[#1A1A1A] p-4 rounded-2xl"
            >
              <Text className="text-brand-muted font-dm">{item.label}</Text>
              <Text className="text-white font-dm-medium">{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={handleLogout}
        className="bg-[#1A1A1A] py-4 rounded-2xl items-center"
      >
        <Text className="text-red-500 font-sora-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
