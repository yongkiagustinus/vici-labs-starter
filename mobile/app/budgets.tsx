import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useStore, selectTransactions } from "@/sync/store";
import { formatMoney } from "@/lib/money";
import { Card, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

/**
 * Budgets — per-category monthly spend. The `budgets` table exists in the
 * backend schema but has no REST route yet, so limits/progress can't sync. Until
 * the sibling backend issue ships `/api/finance/budgets`, this shows the
 * current-month spend per category (the denominator) with an honest banner.
 */
export default function Budgets() {
  const state = useStore();

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const spend = useMemo(() => {
    const buckets = new Map<string, { total: number; currency: string }>();
    for (const t of selectTransactions(state)) {
      if (t.amount >= 0) continue;
      if (t.occurredAt.slice(0, 7) !== month) continue;
      const key = `${t.category || "Uncategorised"}__${t.currency}`;
      const cur = buckets.get(key) ?? { total: 0, currency: t.currency };
      cur.total += Math.abs(t.amount);
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .map(([k, v]) => ({ name: k.split("__")[0], ...v }))
      .sort((a, b) => b.total - a.total);
  }, [state.transactions, month]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <Card style={{ borderColor: theme.warn }}>
        <Muted>
          Per-category limits & progress bars land when the budgets API ships (sibling backend
          issue). Showing this month’s spend so far.
        </Muted>
      </Card>
      {spend.length === 0 ? (
        <Muted>No spend this month.</Muted>
      ) : (
        spend.map((s, i) => (
          <Card key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.text }}>{s.name}</Text>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{formatMoney(s.total, s.currency)}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
