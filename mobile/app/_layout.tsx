import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthContext";
import { theme } from "@/components/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            contentStyle: { backgroundColor: theme.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="lock" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction-new" options={{ presentation: "modal", title: "Quick add" }} />
          <Stack.Screen name="account-new" options={{ presentation: "modal", title: "New account" }} />
          <Stack.Screen name="transaction/[id]" options={{ title: "Transaction" }} />
          <Stack.Screen name="budgets" options={{ title: "Budgets" }} />
          <Stack.Screen name="bills" options={{ title: "Bills & reminders" }} />
          <Stack.Screen name="receivables" options={{ title: "Receivables / IOUs" }} />
          <Stack.Screen name="reports" options={{ title: "Reports" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
