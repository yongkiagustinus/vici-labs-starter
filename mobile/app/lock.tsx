import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { Button, H1, Muted, Screen } from "@/components/ui";
import { theme } from "@/components/theme";

/** Biometric / passcode gate shown on relaunch while a session is held. */
export default function Lock() {
  const { status, unlock, logout } = useAuth();

  useEffect(() => {
    if (status === "locked") void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "authed") return <Redirect href="/accounts" />;
  if (status === "signedout") return <Redirect href="/login" />;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.space(4) }}>
        <H1>Locked</H1>
        <Muted>Unlock with Face ID / Touch ID or your device passcode to continue.</Muted>
        <Button title="Unlock" onPress={() => void unlock()} />
        <Button title="Sign out" variant="ghost" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}
