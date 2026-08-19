import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, formatTry, type PeriodReport, type TrendPoint } from "../../lib/api";
import { Button, PeriodRow, ui } from "../../components/ui";

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PeriodReport | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [report, points, pendingList, budgetAlerts, unreadRes, inst] = await Promise.all([
        api.periodReport(token, year, month),
        api.trend(token, 12),
        api.expenses(token, { year, month, approvalStatus: "PENDING", pageSize: 1 }),
        api.budgetAlerts(token, year, month),
        api.unreadCount(token),
        api.upcomingInstruments(token),
      ]);
      setData(report);
      setTrend(points);
      setPending(pendingList.total);
      setAlerts(budgetAlerts.filter((a: any) => a.over));
      setUnread(unreadRes.count);
      setUpcoming(inst);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rapor alınamadı");
    }
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const maxBar = useMemo(() => {
    return Math.max(
      1,
      ...trend.flatMap((p) => [p.actualIncome, p.actualExpense]),
    );
  }, [trend]);

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Dashboard</Text>
      <Text style={ui.hint}>
        Fiili vs backlog projeksiyonu · {user?.displayName}
      </Text>
      <PeriodRow
        month={month}
        year={year}
        setMonth={setMonth}
        setYear={setYear}
        onLoad={load}
      />
      {user?.role !== "IZLEYICI" ? (
        <View style={ui.row}>
          <Button label="+ Gider" onPress={() => router.push("/expenses")} />
          <Button label="+ Gelir" onPress={() => router.push("/incomes")} />
          <Button
            label="Fiş çek"
            tone="ghost"
            onPress={() => router.push("/capture")}
          />
          <Button
            label="Backlog"
            tone="ghost"
            onPress={() => router.push("/backlog")}
          />
        </View>
      ) : null}
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {pending > 0 || unread > 0 || alerts.length || upcoming.length ? (
        <View style={{ gap: 8 }}>
          {unread > 0 ? (
            <Text style={ui.msg}>{unread} okunmamış bildirim</Text>
          ) : null}
          {pending > 0 ? (
            <Text style={ui.msg}>{pending} gider onay bekliyor</Text>
          ) : null}
          {alerts.map((a) => (
            <Text key={a.id} style={ui.error}>
              Bütçe aşımı: {a.category?.name || a.project?.name || "Genel"} ·{" "}
              {formatTry(a.actual)} / {formatTry(a.amount)}
            </Text>
          ))}
          {upcoming.map((i) => (
            <Text key={i.id} style={ui.hint}>
              Vadesi yaklaşan {i.type === "CHECK" ? "çek" : "senet"}: {i.counterparty}{" "}
              {formatTry(Number(i.amount))} · {String(i.dueDate).slice(0, 10)}
            </Text>
          ))}
        </View>
      ) : null}
      {data ? (
        <View style={styles.grid}>
          <Kpi label="Fiili gelir" value={formatTry(data.actualIncome)} tone="good" />
          <Kpi label="Fiili gider" value={formatTry(data.actualExpense)} tone="bad" />
          <Kpi label="Beklenen gelir" value={formatTry(data.expectedIncome)} />
          <Kpi label="Beklenen gider" value={formatTry(data.expectedExpense)} />
          <Kpi
            label="Gelir Δ"
            value={formatTry(data.deltaIncome)}
            tone={data.deltaIncome >= 0 ? "good" : "bad"}
          />
          <Kpi
            label="Gider Δ"
            value={formatTry(data.deltaExpense)}
            tone={data.deltaExpense <= 0 ? "good" : "bad"}
          />
          <Kpi
            label="Net fiili"
            value={formatTry(data.netActual)}
            tone={data.netActual >= 0 ? "good" : "bad"}
          />
          <Kpi label="Net beklenen" value={formatTry(data.netExpected)} />
        </View>
      ) : null}

      {data?.projects?.length ? (
        <>
          <Text style={ui.section}>Şantiye kırılımı</Text>
          {data.projects.map((p) => (
            <View key={p.id || p.name} style={styles.catRow}>
              <Text style={{ flex: 1 }}>{p.name}</Text>
              <Text style={ui.cardTitle}>{formatTry(p.net)}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={ui.section}>Son 12 ay (fiili)</Text>
      <View style={styles.chart}>
        {trend.map((p) => (
          <View key={`${p.year}-${p.month}`} style={styles.col}>
            <View style={styles.bars}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (p.actualIncome / maxBar) * 90),
                    backgroundColor: "#16A34A",
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (p.actualExpense / maxBar) * 90),
                    backgroundColor: "#DC2626",
                  },
                ]}
              />
            </View>
            <Text style={styles.tick}>{p.month}</Text>
          </View>
        ))}
      </View>
      <Text style={ui.meta}>Yeşil: gelir · Kırmızı: gider</Text>

      {data?.categoryExpense?.length ? (
        <>
          <Text style={ui.section}>Gider kategorileri</Text>
          {data.categoryExpense.map((c) => (
            <View key={c.id} style={styles.catRow}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={{ flex: 1 }}>{c.name}</Text>
              <Text style={ui.cardTitle}>{formatTry(c.gross)}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[
          styles.kpiValue,
          tone === "good" && { color: "#15803D" },
          tone === "bad" && { color: "#B91C1C" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpi: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    minWidth: 160,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  kpiLabel: { color: "#64748B", marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 130,
  },
  col: { flex: 1, alignItems: "center", gap: 4 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 96 },
  bar: { width: 6, borderRadius: 3 },
  tick: { fontSize: 10, color: "#64748B" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
