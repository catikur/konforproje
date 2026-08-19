import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, formatTry } from "../../lib/api";
import { Card, PeriodRow, ui } from "../../components/ui";

export default function CashflowScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [aging, setAging] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    const [cf, ag, al] = await Promise.all([
      api.cashflow(token, year, month),
      api.aging(token),
      api.budgetAlerts(token, year, month),
    ]);
    setWeeks(cf);
    setAging(ag);
    setAlerts(al);
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Nakit akışı</Text>
      <PeriodRow month={month} year={year} setMonth={setMonth} setYear={setYear} onLoad={load} />
      {weeks.map((w) => (
        <Card key={w.week}>
          <Text style={ui.cardTitle}>Hafta {w.week}</Text>
          <Text>Giriş {formatTry(w.inflow)}</Text>
          <Text>Çıkış {formatTry(w.outflow)}</Text>
          <Text>Net {formatTry(w.net)}</Text>
        </Card>
      ))}
      <Text style={ui.section}>Tedarikçi yaşlandırma</Text>
      {aging ? (
        <Card>
          <Text>0-30: {formatTry(aging.buckets.d0_30)}</Text>
          <Text>31-60: {formatTry(aging.buckets.d31_60)}</Text>
          <Text>61-90: {formatTry(aging.buckets.d61_90)}</Text>
          <Text>90+: {formatTry(aging.buckets.d90p)}</Text>
        </Card>
      ) : null}
      {(aging?.suppliers || []).map((s: any) => (
        <Card key={s.name}>
          <Text style={ui.cardTitle}>{s.name}</Text>
          <Text>Açık {formatTry(s.open)}</Text>
        </Card>
      ))}
      <Text style={ui.section}>Bütçe uyarıları</Text>
      {alerts.map((a) => (
        <Card key={a.id}>
          <Text style={ui.cardTitle}>
            {a.category?.name || a.project?.name || "Genel"} {a.over ? "AŞIM" : "OK"}
          </Text>
          <Text>
            {formatTry(a.actual)} / {formatTry(a.amount)}
          </Text>
        </Card>
      ))}
    </View>
  );
}
