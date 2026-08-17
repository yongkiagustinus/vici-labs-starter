import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { theme } from "@/components/theme";

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === "authed") return <Redirect href="/accounts" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    />
  );
}
