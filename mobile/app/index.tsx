import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { theme } from "@/components/theme";

/** Cold-start gate: route by auth status. */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (status === "signedout") return <Redirect href="/login" />;
  if (status === "locked") return <Redirect href="/lock" />;
  return <Redirect href="/accounts" />;
}
