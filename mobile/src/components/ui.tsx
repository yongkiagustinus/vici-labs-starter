import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { statusColor, theme } from "./theme";
import type { TransactionStatus } from "@/api/types";

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "ghost" && styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.btnText, variant === "ghost" && { color: theme.primary }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: theme.space(3) }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export function StatusChip({ status }: { status: TransactionStatus }) {
  return (
    <View style={[styles.chip, { borderColor: statusColor[status] }]}>
      <Text style={[styles.chipText, { color: statusColor[status] }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: theme.space(4) },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  h1: { color: theme.text, fontSize: 24, fontWeight: "700", marginBottom: theme.space(3) },
  muted: { color: theme.textMuted, fontSize: 13 },
  label: { color: theme.textMuted, fontSize: 12, marginBottom: theme.space(1) },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(3),
    fontSize: 16,
  },
  btn: {
    backgroundColor: theme.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.space(3.5),
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.primary },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  chipText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
});
