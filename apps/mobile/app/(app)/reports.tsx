import { useCallback, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import {
  api,
  downloadBlob,
  formatTry,
  type PeriodReport,
} from "../../lib/api";
import { Button, Card, PeriodRow, ui } from "../../components/ui";

export default function ReportsScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PeriodReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setData(await api.periodReport(token, year, month));
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  async function exportExcel() {
    if (!token) return;
    try {
      const blob = await api.exportPeriod(token, year, month);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        downloadBlob(blob, `konfor-${year}-${String(month).padStart(2, "0")}.xlsx`);
        setMessage("Excel indirildi");
      } else {
        setMessage("Excel indirme şu an web’de destekleniyor");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export başarısız");
    }
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Dönem raporu</Text>
      <PeriodRow month={month} year={year} setMonth={setMonth} setYear={setYear} onLoad={load} />
      <Button label="Excel indir" onPress={exportExcel} />
      {message ? <Text style={ui.msg}>{message}</Text> : null}

      {data ? (
        <>
          <Card>
            <Text style={ui.section}>Özet (brüt)</Text>
            <Text>Fiili gelir: {formatTry(data.actualIncome)}</Text>
            <Text>Fiili gider: {formatTry(data.actualExpense)}</Text>
            <Text>Net fiili: {formatTry(data.netActual)}</Text>
            <Text>Beklenen gelir: {formatTry(data.expectedIncome)}</Text>
            <Text>Beklenen gider: {formatTry(data.expectedExpense)}</Text>
            <Text>Net beklenen: {formatTry(data.netExpected)}</Text>
          </Card>
          <Card>
            <Text style={ui.section}>KDV kırılımı</Text>
            <Text>
              Gelir net {formatTry(data.actualIncomeNet)} · KDV {formatTry(data.actualIncomeVat)}
            </Text>
            <Text>
              Gider net {formatTry(data.actualExpenseNet)} · KDV {formatTry(data.actualExpenseVat)}
            </Text>
          </Card>
          <Text style={ui.section}>Kategori — gelir</Text>
          {data.categoryIncome.map((c) => (
            <Card key={c.id}>
              <Text style={ui.cardTitle}>{c.name}</Text>
              <Text>{formatTry(c.gross)}</Text>
            </Card>
          ))}
          <Text style={ui.section}>Kategori — gider</Text>
          {data.categoryExpense.map((c) => (
            <Card key={c.id}>
              <Text style={ui.cardTitle}>{c.name}</Text>
              <Text>{formatTry(c.gross)}</Text>
            </Card>
          ))}
          <Text style={ui.section}>Tedarikçi</Text>
          {data.supplierExpense.map((s) => (
            <Card key={s.id || s.name}>
              <Text style={ui.cardTitle}>{s.name}</Text>
              <Text>{formatTry(s.gross)}</Text>
            </Card>
          ))}
          <Text style={ui.section}>Bekleyen backlog</Text>
          {data.pendingBacklog.map((b) => (
            <Card key={b.id}>
              <Text style={ui.cardTitle}>
                {b.direction === "INCOME" ? "Gelir" : "Gider"} · {b.description}
              </Text>
              <Text>
                {formatTry(b.expectedAmount)} · {b.status}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}
