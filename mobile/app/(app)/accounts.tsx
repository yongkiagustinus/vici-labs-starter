import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore, selectAccounts, accountBalance } from "@/sync/store";
import { formatMoney, subtotalByCurrency } from "@/lib/money";
import { Card, H1, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

export default function Accounts() {
  const state = useStore();
  const accounts = useMemo(() => selectAccounts(state), [state.accounts, state.transactions]);

  // Unified balance, honestly grouped by currency (no fabricated FX conversion).
  const totals = useMemo(
    () =>
      subtotalByCurrency(
        accounts.map((a) => ({ amount: accountBalance(state, a.id), currency: a.currency }))
      ),
    [accounts, state.transactions]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
      <Card>
        <Muted>Unified balance</Muted>
        {Object.keys(totals).length === 0 ? (
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>—</Text>
        ) : (
          Object.entries(totals).map(([cur, minor]) => (
            <Text key={cur} style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>
              {formatMoney(minor, cur)}
            </Text>
          ))
        )}
      </Card>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <H1>Accounts</H1>
        <Pressable onPress={() => router.push("/account-new")}>
          <Text style={{ color: theme.primary, fontSize: 16, fontWeight: "600" }}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<Muted>No accounts yet. Add checking, cash, or a card to start.</Muted>}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
              <Muted>
                {item.type} · {item.currency}
              </Muted>
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
              {formatMoney(accountBalance(state, item.id), item.currency)}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}
