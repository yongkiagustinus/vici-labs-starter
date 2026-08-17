import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { useStore, selectAccounts } from "@/sync/store";
import { toMinor } from "@/lib/money";
import { Button, Field, Muted } from "@/components/ui";
import { theme } from "@/components/theme";
import type { TransactionKind } from "@/api/types";

const KINDS: TransactionKind[] = ["expense", "income", "iou"];

export default function TransactionNew() {
  const { user } = useAuth();
  const state = useStore();
  const add = useStore((s) => s.addTransaction);
  const accounts = useMemo(() => selectAccounts(state), [state.accounts]);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [note, setNote] = useState("");
  const [iouPerson, setIouPerson] = useState("");

  const currency = accounts.find((a) => a.id === accountId)?.currency ?? "USD";

  function save() {
    if (!accountId || !amount) return;
    const magnitude = Math.abs(toMinor(amount, currency));
    // expense = money out (negative); income/iou-lent = money in convention.
    const signed = kind === "expense" ? -magnitude : magnitude;
    add(
      {
        accountId,
        amount: signed,
        currency,
        kind,
        payee: payee || null,
        category: category || null,
        assignedTo: assignedTo || null,
        note: note || null,
        iouPerson: kind === "iou" ? iouPerson || null : null,
        iouDirection: kind === "iou" ? (signed >= 0 ? "lent" : "borrowed") : null,
      },
      user?.id ?? "local"
    );
    router.back();
  }

  if (accounts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4), justifyContent: "center" }}>
        <Muted>Create an account first, then add transactions to it.</Muted>
        <View style={{ height: theme.space(3) }} />
        <Button title="New account" onPress={() => router.replace("/account-new")} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <Muted>Kind</Muted>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: theme.space(2) }}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: kind === k ? theme.primary : theme.border,
              backgroundColor: kind === k ? theme.primary : "transparent",
            }}
          >
            <Text style={{ color: kind === k ? "#fff" : theme.textMuted, textTransform: "capitalize" }}>{k}</Text>
          </Pressable>
        ))}
      </View>

      <Muted>Account</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: theme.space(2) }}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAccountId(a.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: accountId === a.id ? theme.primary : theme.border,
            }}
          >
            <Text style={{ color: accountId === a.id ? theme.primary : theme.textMuted }}>
              {a.name} ({a.currency})
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: theme.space(3) }} />
      <Field label={`Amount (${currency})`} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" />
      <Field label="Payee" value={payee} onChangeText={setPayee} placeholder="Coffee shop" />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Groceries" />
      <Field label="Assigned to (object/person)" value={assignedTo} onChangeText={setAssignedTo} placeholder="Car 1 / Alex" />
      {kind === "iou" ? (
        <Field label="Counterparty" value={iouPerson} onChangeText={setIouPerson} placeholder="Sam" />
      ) : null}
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />

      <Button title="Save" onPress={save} disabled={!amount} />
      <View style={{ height: theme.space(2) }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
