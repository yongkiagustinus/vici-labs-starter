import { useState } from "react";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { isUnauthorized } from "@/api/client";
import { Button, Field, H1, Muted, Screen } from "@/components/ui";
import { theme } from "@/components/theme";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(
        isUnauthorized(e) ? "Invalid email or password" : (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <H1>Welcome back</H1>
        <Muted>Sign in to your household finances.</Muted>
        <View style={{ height: theme.space(6) }} />
        <Field
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        {error ? (
          <Text style={{ color: theme.negative, marginBottom: theme.space(3) }}>{error}</Text>
        ) : null}
        <Button title="Sign in" onPress={onSubmit} loading={busy} />
        <View style={{ height: theme.space(4) }} />
        <Link href="/signup" style={{ color: theme.primary, textAlign: "center" }}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}
