import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStore, pendingCount } from "@/sync/store";
import { syncOnce } from "@/sync/engine";
import { theme } from "./theme";

/** Live sync status pill — tap to force a sync. Surfaces the offline queue. */
export function SyncBadge() {
  const status = useStore((s) => s.status);
  const pending = useStore(pendingCount);
  const color =
    status === "idle"
      ? theme.positive
      : status === "offline"
        ? theme.warn
        : status === "error"
          ? theme.negative
          : theme.primary;
  const label =
    status === "syncing"
      ? "Syncing…"
      : status === "offline"
        ? `Offline · ${pending} queued`
        : status === "error"
          ? "Sync error"
          : pending > 0
            ? `${pending} queued`
            : "Synced";
  return (
    <Pressable onPress={() => void syncOnce()} style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: theme.textMuted, fontSize: 12 },
});
