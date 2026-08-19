import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../lib/auth";
import {
  api,
  canWrite,
  formatTry,
  todayIso,
} from "../../lib/api";
import { Button, Card, Chip, Field, PeriodRow, ui } from "../../components/ui";

export default function ExpensesScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [taxMode, setTaxMode] = useState<"INCLUDED" | "EXCLUDED">("INCLUDED");
  const [vatRate, setVatRate] = useState("20");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [ex, cats, sups] = await Promise.all([
      api.expenses(token, { year, month, q, page, pageSize: 50 }),
      api.categories(token),
      api.suppliers(token),
    ]);
    setItems(ex.items);
    setTotal(ex.total);
    const filtered = cats.filter((c) => c.type === "EXPENSE" || c.type === "BOTH");
    setCategories(filtered);
    setSuppliers(sups);
    if (!categoryId && filtered[0]) setCategoryId(filtered[0].id);
  }, [token, year, month, q, page, categoryId]);

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
    setTaxMode("INCLUDED");
    setVatRate("20");
    setSupplierId(null);
  }

  async function save() {
    if (!token || !categoryId) return;
    const body = {
      description,
      amount: Number(amount.replace(",", ".")),
      expenseDate: date,
      taxMode,
      vatRate: Number(vatRate),
      categoryIds: [categoryId],
      supplierId,
    };
    try {
      if (editingId) await api.updateExpense(token, editingId, body);
      else await api.createExpense(token, body);
      resetForm();
      setMessage(editingId ? "Gider güncellendi" : "Gider kaydedildi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  async function pickFile(expenseId: string) {
    if (!token) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      await api.uploadExpenseFile(token, expenseId, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      });
      setMessage("Ek yüklendi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Yükleme başarısız");
    }
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Giderler</Text>
      <PeriodRow month={month} year={year} setMonth={(n) => { setMonth(n); setPage(1); }} setYear={(n) => { setYear(n); setPage(1); }} onLoad={load} />
      <Field placeholder="Ara" value={q} onChangeText={(t) => { setQ(t); setPage(1); }} />

      {writable ? (
        <Card>
          <Text style={ui.section}>{editingId ? "Gideri düzenle" : "Yeni gider"}</Text>
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
          <Text style={ui.meta}>Kategori</Text>
          <View style={ui.row}>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
          <Text style={ui.meta}>Tedarikçi</Text>
          <View style={ui.row}>
            <Chip label="Yok" active={!supplierId} onPress={() => setSupplierId(null)} />
            {suppliers.map((s) => (
              <Chip key={s.id} label={s.name} active={supplierId === s.id} onPress={() => setSupplierId(s.id)} />
            ))}
          </View>
          <View style={ui.row}>
            <Button label={editingId ? "Güncelle" : "Kaydet"} onPress={save} />
            {editingId ? <Button label="Vazgeç" tone="ghost" onPress={resetForm} /> : null}
          </View>
          {message ? <Text style={ui.msg}>{message}</Text> : null}
        </Card>
      ) : null}

      <Text style={ui.section}>
        {month}/{year} · {total} kayıt
      </Text>
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={ui.cardTitle}>{item.description}</Text>
          <Text>{formatTry(Number(item.grossAmount))}</Text>
          <Text style={ui.meta}>
            {String(item.expenseDate).slice(0, 10)} ·{" "}
            {item.categories?.map((c: any) => c.category.name).join(", ")}
            {item.supplier ? ` · ${item.supplier.name}` : ""} · KDV %{item.vatRate}
          </Text>
          {item.attachments?.length ? (
            <Text style={ui.meta}>{item.attachments.length} ek</Text>
          ) : null}
          {writable ? (
            <View style={ui.row}>
              <Button
                label="Düzenle"
                tone="ghost"
                onPress={() => {
                  setEditingId(item.id);
                  setDescription(item.description);
                  setAmount(String(item.amount));
                  setDate(String(item.expenseDate).slice(0, 10));
                  setTaxMode(item.taxMode);
                  setVatRate(String(item.vatRate));
                  setCategoryId(item.categories?.[0]?.categoryId || null);
                  setSupplierId(item.supplierId || null);
                }}
              />
              <Button label="Ek yükle" tone="ghost" onPress={() => pickFile(item.id)} />
              <Button
                label="Sil"
                tone="danger"
                onPress={async () => {
                  if (!token) return;
                  await api.deleteExpense(token, item.id);
                  await load();
                }}
              />
            </View>
          ) : null}
        </Card>
      ))}
      <View style={ui.row}>
        <Button label="Önceki" tone="ghost" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} />
        <Text style={ui.meta}>Sayfa {page}</Text>
        <Button label="Sonraki" tone="ghost" disabled={page * 50 >= total} onPress={() => setPage((p) => p + 1)} />
      </View>
    </View>
  );
}
