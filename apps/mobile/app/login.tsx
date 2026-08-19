import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";

export default function LoginScreen() {
  const { login, token, loading } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && token) return <Redirect href="/dashboard" />;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>Konfor Proje</Text>
        <Text style={styles.sub}>Gelir–Gider Yönetimi</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          placeholder="Kullanıcı adı"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.btn, submitting && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Giriş yap</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F766E",
    textAlign: "center",
  },
  sub: { textAlign: "center", color: "#64748B", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#0F766E",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#DC2626" },
});
