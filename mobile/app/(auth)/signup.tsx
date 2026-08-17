import { useState } from "react";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { Button, Field, H1, Muted, Screen } from "@/components/ui";
import { theme } from "@/components/theme";

export default function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await signup(email.trim(), password, name.trim() || undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <H1>Create your account</H1>
        <Muted>Start tracking spend across your household.</Muted>
        <View style={{ height: theme.space(6) }} />
        <Field label="Name" value={name} onChangeText={setName} placeholder="Alex" />
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
          placeholder="At least 8 characters"
        />
        {error ? (
          <Text style={{ color: theme.negative, marginBottom: theme.space(3) }}>{error}</Text>
        ) : null}
        <Button title="Create account" onPress={onSubmit} loading={busy} />
        <View style={{ height: theme.space(4) }} />
        <Link href="/login" style={{ color: theme.primary, textAlign: "center" }}>
          I already have an account
        </Link>
      </View>
    </Screen>
  );
}
