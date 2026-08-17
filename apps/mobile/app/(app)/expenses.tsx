import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, formatTry } from "../../lib/api";

export default function ExpensesScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [taxMode, setTaxMode] = useState<"INCLUDED" | "EXCLUDED">("INCLUDED");
  const [vatRate, setVatRate] = useState("20");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [ex, cats, sups] = await Promise.all([
      api.expenses(token, year, month),
      api.categories(token),
      api.suppliers(token),
    ]);
    setItems(ex);
    setCategories(cats.filter((c) => c.type === "EXPENSE" || c.type === "BOTH"));
    setSuppliers(sups);
    if (!categoryId && cats.length) {
      const first = cats.find((c) => c.type === "EXPENSE" || c.type === "BOTH");
      setCategoryId(first?.id || null);
    }
  }, [token, year, month, categoryId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  async function create() {
    if (!token || !categoryId) return;
    setMessage(null);
    try {
      await api.createExpense(token, {
        description,
        amount: Number(amount.replace(",", ".")),
        expenseDate: new Date().toISOString().slice(0, 10),
        taxMode,
        vatRate: Number(vatRate),
        categoryIds: [categoryId],
        supplierId,
      });
      setDescription("");
      setAmount("");
      setMessage("Gider kaydedildi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Giderler</Text>
      <View style={styles.form}>
        <Text style={styles.section}>Yeni gider</Text>
        <TextInput
          style={styles.input}
          placeholder="Açıklama"
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
          <Chip
            label="KDV dahil"
            active={taxMode === "INCLUDED"}
            onPress={() => setTaxMode("INCLUDED")}
          />
          <Chip
            label="KDV hariç"
            active={taxMode === "EXCLUDED"}
            onPress={() => setTaxMode("EXCLUDED")}
          />
        </View>
        <View style={styles.row}>
          {["0", "1", "10", "20"].map((r) => (
            <Chip
              key={r}
              label={`%${r}`}
              active={vatRate === r}
              onPress={() => setVatRate(r)}
            />
          ))}
        </View>
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.row}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>
        <Text style={styles.label}>Tedarikçi</Text>
        <View style={styles.row}>
          <Chip
            label="Yok"
            active={!supplierId}
            onPress={() => setSupplierId(null)}
          />
          {suppliers.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              active={supplierId === s.id}
              onPress={() => setSupplierId(s.id)}
            />
          ))}
        </View>
        <Pressable style={styles.btn} onPress={create}>
          <Text style={styles.btnText}>Kaydet</Text>
        </Pressable>
        {message ? <Text style={styles.msg}>{message}</Text> : null}
      </View>
      <Text style={styles.section}>Bu ay ({month}/{year})</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.description}</Text>
          <Text>{formatTry(Number(item.grossAmount))}</Text>
          <Text style={styles.meta}>
            {item.categories?.map((c: any) => c.category.name).join(", ")}
            {item.supplier ? ` · ${item.supplier.name}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8 },
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
  label: { color: "#64748B", fontWeight: "600" },
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
    gap: 4,
  },
  cardTitle: { fontWeight: "700" },
  meta: { color: "#64748B", fontSize: 12 },
});
