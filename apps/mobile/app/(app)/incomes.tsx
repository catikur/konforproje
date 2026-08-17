import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, formatTry } from "../../lib/api";

export default function IncomesScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [list, cats] = await Promise.all([
      api.incomes(token, year, month),
      api.categories(token),
    ]);
    setItems(list);
    const filtered = cats.filter(
      (c) => c.type === "INCOME" || c.type === "BOTH",
    );
    setCategories(filtered);
    if (!categoryId && filtered[0]) setCategoryId(filtered[0].id);
  }, [token, year, month, categoryId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  async function create() {
    if (!token || !categoryId) return;
    try {
      await api.createIncome(token, {
        description,
        amount: Number(amount.replace(",", ".")),
        incomeDate: new Date().toISOString().slice(0, 10),
        taxMode: "INCLUDED",
        vatRate: 20,
        categoryIds: [categoryId],
      });
      setDescription("");
      setAmount("");
      setMessage("Gelir kaydedildi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Gelirler</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Gelir açıklaması"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Tutar"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={styles.row}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[styles.chip, categoryId === c.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryId === c.id && styles.chipTextActive,
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.btn} onPress={create}>
          <Text style={styles.btnText}>Kaydet</Text>
        </Pressable>
        {message ? <Text style={styles.msg}>{message}</Text> : null}
      </View>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.description}</Text>
          <Text>{formatTry(Number(item.grossAmount))}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800" },
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
});
