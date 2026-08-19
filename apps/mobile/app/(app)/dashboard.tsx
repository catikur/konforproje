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

export default function DashboardScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.periodReport>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const report = await api.periodReport(
        token,
        Number(year),
        Number(month),
      );
      setData(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rapor alınamadı");
    }
  }, [token, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.hint}>Fiili vs backlog projeksiyon karşılaştırması</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={month}
          onChangeText={setMonth}
          keyboardType="number-pad"
          placeholder="Ay"
        />
        <TextInput
          style={styles.input}
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          placeholder="Yıl"
        />
        <Pressable style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Getir</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <View style={styles.grid}>
          <Kpi label="Fiili gelir" value={formatTry(data.actualIncome)} tone="good" />
          <Kpi label="Fiili gider" value={formatTry(data.actualExpense)} tone="bad" />
          <Kpi label="Beklenen gelir" value={formatTry(data.expectedIncome)} />
          <Kpi label="Beklenen gider" value={formatTry(data.expectedExpense)} />
          <Kpi label="Gelir Δ" value={formatTry(data.deltaIncome)} tone={data.deltaIncome >= 0 ? "good" : "bad"} />
          <Kpi label="Gider Δ" value={formatTry(data.deltaExpense)} tone={data.deltaExpense <= 0 ? "good" : "bad"} />
          <Kpi label="Net fiili" value={formatTry(data.netActual)} tone={data.netActual >= 0 ? "good" : "bad"} />
          <Kpi label="Net beklenen" value={formatTry(data.netExpected)} />
        </View>
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
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  hint: { color: "#64748B" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    minWidth: 80,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  error: { color: "#DC2626" },
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
});
