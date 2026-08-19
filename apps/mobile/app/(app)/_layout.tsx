import { Redirect, Slot, usePathname, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../lib/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/capture", label: "Fiş" },
  { href: "/expenses", label: "Giderler" },
  { href: "/incomes", label: "Gelirler" },
  { href: "/backlog", label: "Backlog" },
  { href: "/cashflow", label: "Nakit" },
  { href: "/contracts", label: "Hakediş" },
  { href: "/instruments", label: "Çek" },
  { href: "/reports", label: "Raporlar" },
  { href: "/notifications", label: "Bildirim" },
  { href: "/account", label: "Hesap" },
  { href: "/admin", label: "Admin" },
] as const;

export default function AppLayout() {
  const { token, user, loading, logout } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;

  const nav = (
    <View style={[styles.nav, wide ? styles.navSide : styles.navTop]}>
      <Text style={styles.navBrand}>Konfor Proje</Text>
      <Text style={styles.navUser}>
        {user?.displayName} · {user?.role}
      </Text>
      {links.map((l) => {
        if (l.href === "/admin" && user?.role !== "ADMIN") return null;
        const active = pathname.startsWith(l.href);
        return (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as never)}
            style={[styles.navItem, active && styles.navItemActive]}
          >
            <Text style={[styles.navText, active && styles.navTextActive]}>
              {l.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
        style={styles.logout}
      >
        <Text style={styles.logoutText}>Çıkış</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.shell, wide && styles.shellRow]}>
      {nav}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      >
        <Slot />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  shell: { flex: 1, backgroundColor: "#F8FAFC" },
  shellRow: { flexDirection: "row" },
  nav: { backgroundColor: "#0F766E", padding: 16, gap: 8 },
  navSide: { width: 220, minHeight: "100%" as never },
  navTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  navBrand: { color: "#fff", fontWeight: "800", fontSize: 18, marginRight: 8 },
  navUser: { color: "#A7F3D0", marginRight: 8, fontSize: 12 },
  navItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  navItemActive: { backgroundColor: "#115E59" },
  navText: { color: "#CCFBF1", fontWeight: "600" },
  navTextActive: { color: "#fff" },
  logout: { marginLeft: "auto" as never, padding: 8 },
  logoutText: { color: "#FECACA", fontWeight: "600" },
  content: { flex: 1 },
});
