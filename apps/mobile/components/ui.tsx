import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ReactNode } from "react";

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress?: () => void;
  tone?: "primary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        tone === "danger" && styles.btnDanger,
        tone === "ghost" && styles.btnGhost,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          tone === "ghost" && { color: "#0F766E" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field(props: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <TextInput
      style={styles.input}
      placeholder={props.placeholder}
      value={props.value}
      onChangeText={props.onChangeText}
      secureTextEntry={props.secureTextEntry}
      keyboardType={props.keyboardType}
      autoCapitalize={props.autoCapitalize}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function PeriodRow({
  month,
  year,
  setMonth,
  setYear,
  onLoad,
}: {
  month: number;
  year: number;
  setMonth: (n: number) => void;
  setYear: (n: number) => void;
  onLoad?: () => void;
}) {
  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { minWidth: 70 }]}
        value={String(month)}
        onChangeText={(t) => setMonth(Number(t) || 1)}
        keyboardType="number-pad"
        placeholder="Ay"
      />
      <TextInput
        style={[styles.input, { minWidth: 90 }]}
        value={String(year)}
        onChangeText={(t) => setYear(Number(t) || 2026)}
        keyboardType="number-pad"
        placeholder="Yıl"
      />
      {onLoad ? <Button label="Getir" onPress={onLoad} /> : null}
    </View>
  );
}

export const ui = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  hint: { color: "#64748B" },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8, color: "#0F172A" },
  msg: { color: "#0F766E" },
  error: { color: "#DC2626" },
  meta: { color: "#64748B", fontSize: 12 },
  cardTitle: { fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
});

const styles = StyleSheet.create({
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDanger: { backgroundColor: "#B91C1C" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0F766E" },
  btnText: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
});
