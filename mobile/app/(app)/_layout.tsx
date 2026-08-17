import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { SyncBadge } from "@/components/SyncBadge";
import { theme } from "@/components/theme";

export default function AppLayout() {
  const { status } = useAuth();
  if (status === "signedout") return <Redirect href="/login" />;
  if (status === "locked") return <Redirect href="/lock" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerRight: () => (
          <>
            {/* live sync status, padded from the edge */}
            <SyncBadge />
            {/* eslint-disable-next-line react-native/no-inline-styles */}
          </>
        ),
        headerRightContainerStyle: { paddingRight: 16 },
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
      }}
    >
      <Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
      <Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
      <Tabs.Screen name="reconcile" options={{ title: "Reconcile" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
