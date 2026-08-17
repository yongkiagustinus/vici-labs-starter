import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { Button, Card, Muted } from "@/components/ui";
import { theme } from "@/components/theme";

const LINKS: Array<{ href: string; title: string; sub: string }> = [
  { href: "/budgets", title: "Budgets", sub: "Per-category monthly progress" },
  { href: "/bills", title: "Bills & reminders", sub: "Due dates, lead time, partial payment" },
  { href: "/receivables", title: "Receivables / IOUs", sub: "Who owes whom · settle" },
  { href: "/reports", title: "Reports", sub: "By category, contributor, object/person" },
];

export default function More() {
  const { user, logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.space(4) }}>
      {LINKS.map((l) => (
        <Pressable key={l.href} onPress={() => router.push(l.href as never)}>
          <Card>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{l.title}</Text>
            <Muted>{l.sub}</Muted>
          </Card>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Muted>Signed in as {user?.email}</Muted>
      <View style={{ height: theme.space(2) }} />
      <Button title="Sign out" variant="ghost" onPress={() => void logout()} />
    </View>
  );
}
