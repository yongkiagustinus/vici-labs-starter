import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "@/sync/store";
import { toMajor, toMinor, formatMoney } from "@/lib/money";
import { Button, Field, Muted, StatusChip } from "@/components/ui";
import { theme } from "@/components/theme";
import { TRANSACTION_STATUSES, type TransactionStatus } from "@/api/types";

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txn = useStore((s) => (id ? s.transactions[id] : undefined));
  const edit = useStore((s) => s.editTransaction);

  const [payee, setPayee] = useState(txn?.payee ?? "");
  const [category, setCategory] = useState(txn?.category ?? "");
  const [assignedTo, setAssignedTo] = useState(txn?.assignedTo ?? "");
  const [amount, setAmount] = useState(
    txn ? String(toMajor(Math.abs(txn.amount), txn.currency)) : ""
  );

  if (!txn) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
        <Muted>Transaction not found (it may have been deleted).</Muted>
      </View>
    );
  }

  function saveFields() {
    const sign = txn!.amount < 0 ? -1 : 1;
    edit(txn!.id, {
      payee: payee || null,
      category: category || null,
      assignedTo: assignedTo || null,
      amount: amount ? sign * Math.abs(toMinor(amount, txn!.currency)) : txn!.amount,
    });
    router.back();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: theme.space(4) }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>
        {formatMoney(txn.amount, txn.currency)}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: theme.space(3) }}>
        <StatusChip status={txn.status} />
        <Muted>{txn.kind}</Muted>
      </View>

      <Muted>Status</Muted>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: theme.space(2) }}>
        {TRANSACTION_STATUSES.map((st: TransactionStatus) => (
          <Pressable
            key={st}
            onPress={() => edit(txn.id, { status: st })}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: txn.status === st ? theme.primary : theme.border,
              backgroundColor: txn.status === st ? theme.primary : "transparent",
            }}
          >
            <Text style={{ color: txn.status === st ? "#fff" : theme.textMuted, textTransform: "capitalize" }}>{st}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: theme.space(3) }} />
      <Field label="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Field label="Payee" value={payee} onChangeText={setPayee} />
      <Field label="Category" value={category} onChangeText={setCategory} />
      <Field label="Assigned to" value={assignedTo} onChangeText={setAssignedTo} />

      {txn.kind === "iou" ? (
        <Button
          title={txn.iouSettled ? "Mark unsettled" : "Settle IOU"}
          variant="ghost"
          onPress={() => edit(txn.id, { settleIou: !txn.iouSettled })}
        />
      ) : null}

      <View style={{ height: theme.space(2) }} />
      <Button title="Save" onPress={saveFields} />
      <View style={{ height: theme.space(2) }} />
      <Button
        title="Delete"
        variant="ghost"
        onPress={() => {
          edit(txn.id, { deleted: true });
          router.back();
        }}
      />
    </ScrollView>
  );
}
