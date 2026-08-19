import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, canWrite, formatTry } from "../../lib/api";
import { Button, Card, Chip, Field, PeriodRow, ui } from "../../components/ui";

const STATUSES = ["PLANNED", "PARTIAL", "DONE", "CANCELLED"] as const;

export default function BacklogScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<any[]>([]);
  const [actuals, setActuals] = useState<any[]>([]);
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("PLANNED");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [list, incomes, expenses] = await Promise.all([
      api.backlog(token, { year, month, pageSize: 100 }),
      api.incomes(token, { year, month, pageSize: 100 }),
      api.expenses(token, { year, month, pageSize: 100 }),
    ]);
    setItems(list.items);
    setActuals([
      ...incomes.items.map((i: any) => ({ ...i, kind: "INCOME" })),
      ...expenses.items.map((e: any) => ({ ...e, kind: "EXPENSE" })),
    ]);
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  async function save() {
    if (!token) return;
    const body = {
      direction,
      periodYear: year,
      periodMonth: month,
      expectedAmount: Number(amount.replace(",", ".")),
      description,
      categoryIds: [],
      status,
    };
    try {
      if (editingId) await api.updateBacklog(token, editingId, body);
      else await api.createBacklog(token, body);
      setDescription("");
      setAmount("");
      setEditingId(null);
      setMessage(editingId ? "Güncellendi" : "Backlog eklendi");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayıt başarısız");
    }
  }

  async function copyPrev() {
    if (!token) return;
    const from = new Date(year, month - 2, 1);
    try {
      const res = await api.copyBacklog(token, {
        fromYear: from.getFullYear(),
        fromMonth: from.getMonth() + 1,
        toYear: year,
        toMonth: month,
      });
      setMessage(`${(res as { copied: number }).copied} kalem kopyalandı`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kopyalama başarısız");
    }
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Backlog / Planlama</Text>
      <Text style={ui.hint}>
        {month}/{year} dönemi beklenen gelir ve giderler
      </Text>
      <PeriodRow month={month} year={year} setMonth={setMonth} setYear={setYear} onLoad={load} />

      {writable ? (
        <Card>
          <View style={ui.row}>
            <Chip label="Gelir planı" active={direction === "INCOME"} onPress={() => setDirection("INCOME")} />
            <Chip label="Gider planı" active={direction === "EXPENSE"} onPress={() => setDirection("EXPENSE")} />
            <Button label="Önceki ayı kopyala" tone="ghost" onPress={copyPrev} />
          </View>
          <Field placeholder="Açıklama" value={description} onChangeText={setDescription} />
          <Field placeholder="Beklenen tutar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <View style={ui.row}>
            {STATUSES.map((s) => (
              <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
          <View style={ui.row}>
            <Button label={editingId ? "Güncelle" : "Plan ekle"} onPress={save} />
            {editingId ? (
              <Button
                label="Vazgeç"
                tone="ghost"
                onPress={() => {
                  setEditingId(null);
                  setDescription("");
                  setAmount("");
                }}
              />
            ) : null}
          </View>
          {message ? <Text style={ui.msg}>{message}</Text> : null}
        </Card>
      ) : null}

      {items.map((item) => (
        <Card key={item.id}>
          <Text style={ui.cardTitle}>
            {item.direction === "INCOME" ? "Gelir" : "Gider"} · {item.description}
          </Text>
          <Text>
            Beklenen {formatTry(Number(item.expectedAmount))} · Bağlı{" "}
            {formatTry(Number(item.linkedAmount || 0))}
          </Text>
          <Text style={ui.meta}>
            {item.status} · kalan {formatTry(Number(item.remainingAmount || 0))}
          </Text>
          {writable ? (
            <View style={ui.row}>
              <Button
                label="Düzenle"
                tone="ghost"
                onPress={() => {
                  setEditingId(item.id);
                  setDescription(item.description);
                  setAmount(String(item.expectedAmount));
                  setDirection(item.direction);
                  setStatus(item.status);
                }}
              />
              <Button
                label="Sil"
                tone="danger"
                onPress={async () => {
                  if (!token) return;
                  await api.deleteBacklog(token, item.id);
                  await load();
                }}
              />
            </View>
          ) : null}
          {writable ? (
            <View>
              <Text style={ui.meta}>Fiiliye bağla</Text>
              <View style={ui.row}>
                {actuals
                  .filter((a) => a.kind === item.direction)
                  .slice(0, 8)
                  .map((a) => (
                    <Chip
                      key={a.id}
                      label={`${a.description} ${formatTry(Number(a.grossAmount))}`}
                      onPress={async () => {
                        if (!token) return;
                        try {
                          await api.linkBacklog(
                            token,
                            item.id,
                            item.direction === "INCOME"
                              ? { incomeId: a.id }
                              : { expenseId: a.id },
                          );
                          await load();
                        } catch (e) {
                          setMessage(e instanceof Error ? e.message : "Bağlama başarısız");
                        }
                      }}
                    />
                  ))}
              </View>
            </View>
          ) : null}
        </Card>
      ))}
      {!items.length ? <Text style={ui.hint}>Bu ay backlog yok — kopyala veya ekle.</Text> : null}
    </View>
  );
}
