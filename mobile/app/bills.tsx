import { ScrollView, Text } from "react-native";
import { Card, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

/**
 * Bills & reminders — the `bills` table exists in the backend schema, but v0
 * needs three things this client can't ship alone: a `/api/finance/bills` REST
 * route (sibling backend issue), push-notification delivery + scheduling
 * (VIC-9 prod infra), and lead-time/partial-payment logic. This screen documents
 * the intended surface so the dependency is explicit rather than a silent gap.
 */
const PLANNED = [
  "Recurring bills with due date + recurrence (none/weekly/monthly/yearly).",
  "Reminder lead time (default 3 days) delivered via push (needs VIC-9 infra).",
  "Partial payment tracking against each bill.",
  "Offline-first + delta sync, same engine as accounts/transactions.",
];

export default function Bills() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <Card style={{ borderColor: theme.warn }}>
        <Text style={{ color: theme.text, fontWeight: "700", marginBottom: theme.space(2) }}>
          Bills & reminders — pending backend
        </Text>
        <Muted>
          Blocked on `/api/finance/bills` (sibling backend issue) and push infrastructure (VIC-9).
          Planned v0 surface:
        </Muted>
      </Card>
      {PLANNED.map((p, i) => (
        <Card key={i}>
          <Text style={{ color: theme.text }}>• {p}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}
