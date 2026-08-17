import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useStore, selectTransactions } from "@/sync/store";
import { formatMoney } from "@/lib/money";
import { Card, Muted, StatusChip } from "@/components/ui";
import { theme } from "@/components/theme";

/**
 * Reconcile: advance Cleared → Reconciled once you've matched a transaction
 * against your statement. Uncleared items are surfaced so nothing is forgotten.
 */
export default function Reconcile() {
  const state = useStore();
  const edit = useStore((s) => s.editTransaction);

  const { cleared, uncleared } = useMemo(() => {
    const all = selectTransactions(state);
    return {
      cleared: all.filter((t) => t.status === "cleared"),
      uncleared: all.filter((t) => t.status === "uncleared"),
    };
  }, [state.transactions]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
      <Card>
        <Muted>Waiting to reconcile</Muted>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
          {cleared.length} cleared · {uncleared.length} uncleared
        </Text>
      </Card>

      <FlatList
        data={cleared}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          cleared.length ? <Muted>Tap to mark reconciled</Muted> : undefined
        }
        ListEmptyComponent={
          <Muted>Nothing cleared yet. Clear transactions first, then reconcile here.</Muted>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => edit(item.id, { status: "reconciled" })}>
            <Card
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>
                  {item.payee || item.category || "(no payee)"}
                </Text>
                <StatusChip status={item.status} />
              </View>
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {formatMoney(item.amount, item.currency)}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
