import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore, selectTransactions } from "@/sync/store";
import { useShake } from "@/lib/useShake";
import { formatMoney } from "@/lib/money";
import { Field, Muted, StatusChip } from "@/components/ui";
import { theme } from "@/components/theme";

export default function Transactions() {
  const state = useStore();
  const [q, setQ] = useState("");

  // Shake or long-press the header to quick-add.
  useShake(() => router.push("/transaction-new"));

  const txns = useMemo(() => {
    const all = selectTransactions(state);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((t) =>
      [t.payee, t.category, t.note, t.assignedTo, t.iouPerson]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle))
    );
  }, [state.transactions, q]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
      <Pressable
        onLongPress={() => router.push("/transaction-new")}
        delayLongPress={300}
        style={{ marginBottom: theme.space(2) }}
      >
        <Muted>Shake the phone or long-press here to quick-add.</Muted>
      </Pressable>

      <Field placeholder="Search payee, category, note, person…" value={q} onChangeText={setQ} />

      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Muted>No transactions match.</Muted>}
        renderItem={({ item }) => {
          const acc = state.accounts[item.accountId];
          return (
            <Pressable onPress={() => router.push(`/transaction/${item.id}`)}>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: theme.space(3.5),
                  marginBottom: theme.space(2),
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                    {item.payee || item.category || "(no payee)"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <StatusChip status={item.status} />
                    <Muted>
                      {acc?.name ?? "account"}
                      {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                    </Muted>
                  </View>
                </View>
                <Text
                  style={{
                    color: item.amount < 0 ? theme.negative : theme.positive,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {formatMoney(item.amount, item.currency)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={() => router.push("/transaction-new")}
        style={{
          position: "absolute",
          right: theme.space(5),
          bottom: theme.space(6),
          backgroundColor: theme.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 28, marginTop: -2 }}>+</Text>
      </Pressable>
    </View>
  );
}
