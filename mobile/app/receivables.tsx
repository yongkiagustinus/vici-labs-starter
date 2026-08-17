import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useStore, selectTransactions } from "@/sync/store";
import { formatMoney } from "@/lib/money";
import { Card, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

/** Receivables / IOU list — derived from kind === "iou" transactions. */
export default function Receivables() {
  const state = useStore();
  const edit = useStore((s) => s.editTransaction);

  const ious = useMemo(
    () => selectTransactions(state).filter((t) => t.kind === "iou"),
    [state.transactions]
  );

  const open = ious.filter((t) => !t.iouSettled);
  const outstanding = open.reduce<Record<string, number>>((acc, t) => {
    acc[t.currency] = (acc[t.currency] ?? 0) + t.amount;
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
      <Card>
        <Muted>Outstanding (unsettled)</Muted>
        {Object.keys(outstanding).length === 0 ? (
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>All settled 🎉</Text>
        ) : (
          Object.entries(outstanding).map(([cur, minor]) => (
            <Text key={cur} style={{ color: theme.text, fontSize: 22, fontWeight: "700" }}>
              {formatMoney(minor, cur)}
            </Text>
          ))
        )}
      </Card>

      <FlatList
        data={ious}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Muted>No IOUs yet. Add a transaction with kind “iou”.</Muted>}
        renderItem={({ item }) => (
          <Pressable onPress={() => edit(item.id, { settleIou: !item.iouSettled })}>
            <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>
                  {item.iouPerson || "Someone"} · {item.iouDirection ?? "—"}
                </Text>
                <Muted>{item.iouSettled ? "Settled — tap to reopen" : "Open — tap to settle"}</Muted>
              </View>
              <Text
                style={{
                  color: item.iouSettled ? theme.textMuted : theme.text,
                  fontWeight: "700",
                  textDecorationLine: item.iouSettled ? "line-through" : "none",
                }}
              >
                {formatMoney(item.amount, item.currency)}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
