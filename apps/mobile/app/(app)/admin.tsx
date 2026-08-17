import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";

export default function AdminScreen() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    const [u, c] = await Promise.all([api.users(token), api.categories(token)]);
    setUsers(u);
    setCategories(c);
  }, [token, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  if (user && !isAdmin) {
    return <Redirect href="/dashboard" />;
  }

  async function createUser() {
    if (!token) return;
    try {
      await api.createUser(token, {
        username,
        password,
        displayName,
        role: "FINANS",
      });
      setUsername("");
      setPassword("");
      setDisplayName("");
      setMessage("Kullanıcı oluşturuldu");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Hata");
    }
  }

  async function createCategory() {
    if (!token) return;
    try {
      await api.createCategory(token, {
        name: categoryName,
        type: "BOTH",
        color: "#0F766E",
      });
      setCategoryName("");
      setMessage("Kategori eklendi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Hata");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Admin bakım</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}

      <View style={styles.form}>
        <Text style={styles.section}>Yeni kullanıcı</Text>
        <TextInput
          style={styles.input}
          placeholder="Görünen ad"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={styles.input}
          placeholder="Kullanıcı adı"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.btn} onPress={createUser}>
          <Text style={styles.btnText}>Kullanıcı oluştur</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <Text style={styles.section}>Yeni kategori</Text>
        <TextInput
          style={styles.input}
          placeholder="Kategori adı"
          value={categoryName}
          onChangeText={setCategoryName}
        />
        <Pressable style={styles.btn} onPress={createCategory}>
          <Text style={styles.btnText}>Kategori ekle</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Kullanıcılar</Text>
      {users.map((u) => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {u.displayName} ({u.username})
          </Text>
          <Text>
            {u.role} · {u.isActive ? "aktif" : "pasif"}
          </Text>
        </View>
      ))}

      <Text style={styles.section}>Kategoriler</Text>
      {categories.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{c.name}</Text>
          <Text>{c.type}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "700" },
  form: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
  },
  btn: {
    backgroundColor: "#0F766E",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  msg: { color: "#0F766E" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: { fontWeight: "700" },
});
