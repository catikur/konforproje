import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, formatTry } from "../../lib/api";

export default function BacklogScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<any[]>([]);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setItems(await api.backlog(token, year, month));
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  async function create() {
    if (!token) return;
    try {
      await api.createBacklog(token, {
        direction,
        periodYear: year,
        periodMonth: month,
        expectedAmount: Number(amount.replace(",", ".")),
        description,
        categoryIds: [],
        status: "PLANNED",
      });
      setDescription("");
      setAmount("");
      setMessage("Backlog eklendi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Backlog / Planlama</Text>
      <Text style={styles.hint}>
        {month}/{year} dönemi beklenen gelir ve giderler
      </Text>
      <View style={styles.form}>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, direction === "INCOME" && styles.chipActive]}
            onPress={() => setDirection("INCOME")}
          >
            <Text
              style={[
                styles.chipText,
                direction === "INCOME" && styles.chipTextActive,
              ]}
            >
              Gelir planı
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, direction === "EXPENSE" && styles.chipActive]}
            onPress={() => setDirection("EXPENSE")}
          >
            <Text
              style={[
                styles.chipText,
                direction === "EXPENSE" && styles.chipTextActive,
              ]}
            >
              Gider planı
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Açıklama"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Beklenen tutar"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Pressable style={styles.btn} onPress={create}>
          <Text style={styles.btnText}>Plan ekle</Text>
        </Pressable>
        {message ? <Text style={styles.msg}>{message}</Text> : null}
      </View>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {item.direction === "INCOME" ? "Gelir" : "Gider"} ·{" "}
            {item.description}
          </Text>
          <Text>{formatTry(Number(item.expectedAmount))}</Text>
          <Text style={styles.meta}>{item.status}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  hint: { color: "#64748B" },
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
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  chipText: { color: "#334155" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
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
  meta: { color: "#64748B", fontSize: 12 },
});
