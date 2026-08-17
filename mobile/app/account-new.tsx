import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { useStore } from "@/sync/store";
import { toMinor } from "@/lib/money";
import { Button, Field, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

const TYPES = ["checking", "savings", "cash", "credit", "investment", "other"];
const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "JPY", "SGD"];

export default function AccountNew() {
  const { user } = useAuth();
  const add = useStore((s) => s.addAccount);
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [currency, setCurrency] = useState("USD");
  const [opening, setOpening] = useState("");

  function save() {
    if (!name) return;
    add(
      {
        name,
        type,
        currency,
        openingBalance: opening ? toMinor(opening, currency) : 0,
      },
      user?.id ?? "local"
    );
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Everyday checking" />

      <Muted>Type</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: theme.space(2) }}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: type === t ? theme.primary : theme.border }}
          >
            <Text style={{ color: type === t ? theme.primary : theme.textMuted, textTransform: "capitalize" }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Muted>Currency</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: theme.space(2) }}>
        {CURRENCIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCurrency(c)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: currency === c ? theme.primary : theme.border }}
          >
            <Text style={{ color: currency === c ? theme.primary : theme.textMuted }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: theme.space(3) }} />
      <Field label={`Opening balance (${currency})`} keyboardType="decimal-pad" value={opening} onChangeText={setOpening} placeholder="0.00" />

      <Button title="Create account" onPress={save} disabled={!name} />
      <View style={{ height: theme.space(2) }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
