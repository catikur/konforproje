import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, canWrite, formatTry, todayIso } from "../../lib/api";
import { Button, Card, Chip, Field, PeriodRow, ui } from "../../components/ui";

export default function IncomesScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [taxMode, setTaxMode] = useState<"INCLUDED" | "EXCLUDED">("INCLUDED");
  const [vatRate, setVatRate] = useState("20");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [list, cats] = await Promise.all([
      api.incomes(token, { year, month, q, pageSize: 50 }),
      api.categories(token),
    ]);
    setItems(list.items);
    setTotal(list.total);
    const filtered = cats.filter((c) => c.type === "INCOME" || c.type === "BOTH");
    setCategories(filtered);
    if (!categoryId && filtered[0]) setCategoryId(filtered[0].id);
  }, [token, year, month, q, categoryId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setAmount("");
    setDate(todayIso());
  }

  async function save() {
    if (!token || !categoryId) return;
    const body = {
      description,
      amount: Number(amount.replace(",", ".")),
      incomeDate: date,
      taxMode,
      vatRate: Number(vatRate),
      categoryIds: [categoryId],
    };
    try {
      if (editingId) await api.updateIncome(token, editingId, body);
      else await api.createIncome(token, body);
      resetForm();
      setMessage(editingId ? "Gelir güncellendi" : "Gelir kaydedildi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Gelirler</Text>
      <PeriodRow month={month} year={year} setMonth={setMonth} setYear={setYear} onLoad={load} />
      <Field placeholder="Ara" value={q} onChangeText={setQ} />

      {writable ? (
        <Card>
          <Text style={ui.section}>{editingId ? "Geliri düzenle" : "Yeni gelir"}</Text>
          <Field placeholder="Açıklama" value={description} onChangeText={setDescription} />
          <Field placeholder="Tutar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Field placeholder="Tarih YYYY-AA-GG" value={date} onChangeText={setDate} />
          <View style={ui.row}>
            <Chip label="KDV dahil" active={taxMode === "INCLUDED"} onPress={() => setTaxMode("INCLUDED")} />
            <Chip label="KDV hariç" active={taxMode === "EXCLUDED"} onPress={() => setTaxMode("EXCLUDED")} />
          </View>
          <View style={ui.row}>
            {["0", "1", "10", "20"].map((r) => (
              <Chip key={r} label={`%${r}`} active={vatRate === r} onPress={() => setVatRate(r)} />
            ))}
          </View>
          <View style={ui.row}>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
          <View style={ui.row}>
            <Button label={editingId ? "Güncelle" : "Kaydet"} onPress={save} />
            {editingId ? <Button label="Vazgeç" tone="ghost" onPress={resetForm} /> : null}
          </View>
          {message ? <Text style={ui.msg}>{message}</Text> : null}
        </Card>
      ) : null}

      <Text style={ui.section}>{total} kayıt</Text>
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={ui.cardTitle}>{item.description}</Text>
          <Text>{formatTry(Number(item.grossAmount))}</Text>
          <Text style={ui.meta}>
            {String(item.incomeDate).slice(0, 10)} ·{" "}
            {item.categories?.map((c: any) => c.category.name).join(", ")}
          </Text>
          {writable ? (
            <View style={ui.row}>
              <Button
                label="Düzenle"
                tone="ghost"
                onPress={() => {
                  setEditingId(item.id);
                  setDescription(item.description);
                  setAmount(String(item.amount));
                  setDate(String(item.incomeDate).slice(0, 10));
                  setTaxMode(item.taxMode);
                  setVatRate(String(item.vatRate));
                  setCategoryId(item.categories?.[0]?.categoryId || null);
                }}
              />
              <Button
                label="Sil"
                tone="danger"
                onPress={async () => {
                  if (!token) return;
                  await api.deleteIncome(token, item.id);
                  await load();
                }}
              />
            </View>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
