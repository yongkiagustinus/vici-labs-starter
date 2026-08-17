import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore, selectTransactions } from "@/sync/store";
import { formatMoney } from "@/lib/money";
import { Card, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

type Dimension = "category" | "contributor" | "object";

const DIMENSIONS: Array<{ key: Dimension; label: string }> = [
  { key: "category", label: "By category" },
  { key: "contributor", label: "By contributor" },
  { key: "object", label: "By object/person" },
];

/** Reports — spend grouped by category, contributor (authorId), or assignedTo. */
export default function Reports() {
  const state = useStore();
  const [dim, setDim] = useState<Dimension>("category");

  const rows = useMemo(() => {
    const txns = selectTransactions(state).filter((t) => t.amount < 0); // spend only
    const buckets = new Map<string, { total: number; currency: string }>();
    for (const t of txns) {
      const key =
        dim === "category"
          ? t.category || "Uncategorised"
          : dim === "contributor"
            ? t.authorId
            : t.assignedTo || "Unassigned";
      const label = `${key}__${t.currency}`;
      const cur = buckets.get(label) ?? { total: 0, currency: t.currency };
      cur.total += Math.abs(t.amount);
      buckets.set(label, cur);
    }
    return [...buckets.entries()]
      .map(([label, v]) => ({ name: label.split("__")[0], ...v }))
      .sort((a, b) => b.total - a.total);
  }, [state.transactions, dim]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: theme.space(3) }}>
        {DIMENSIONS.map((d) => (
          <Pressable
            key={d.key}
            onPress={() => setDim(d.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: dim === d.key ? theme.primary : theme.border,
              backgroundColor: dim === d.key ? theme.primary : "transparent",
            }}
          >
            <Text style={{ color: dim === d.key ? "#fff" : theme.textMuted, fontSize: 12 }}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <Muted>No spend recorded yet.</Muted>
      ) : (
        rows.map((r, i) => (
          <Card key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.text }}>{r.name}</Text>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{formatMoney(r.total, r.currency)}</Text>
          </Card>
        ))
      )}
      <Muted>
        Contributor rows show the member id that authored each entry — per-record attribution from the
        shared household.
      </Muted>
    </ScrollView>
  );
}
