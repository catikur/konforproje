import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, canWrite, formatTry, todayIso } from "../../lib/api";
import { Button, Card, Chip, Field, ui } from "../../components/ui";

export default function InstrumentsScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState<"CHECK" | "NOTE">("CHECK");
  const [direction, setDirection] = useState<"GIVEN" | "RECEIVED">("GIVEN");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [counterparty, setCounterparty] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setItems(await api.instruments(token));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Çek / Senet</Text>
      {writable ? (
        <Card>
          <View style={ui.row}>
            <Chip label="Çek" active={type === "CHECK"} onPress={() => setType("CHECK")} />
            <Chip label="Senet" active={type === "NOTE"} onPress={() => setType("NOTE")} />
            <Chip label="Verilen" active={direction === "GIVEN"} onPress={() => setDirection("GIVEN")} />
            <Chip label="Alınan" active={direction === "RECEIVED"} onPress={() => setDirection("RECEIVED")} />
          </View>
          <Field placeholder="Karşı taraf" value={counterparty} onChangeText={setCounterparty} />
          <Field placeholder="Tutar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Field placeholder="Vade YYYY-AA-GG" value={dueDate} onChangeText={setDueDate} />
          <Button
            label="Kaydet"
            onPress={async () => {
              if (!token) return;
              await api.createInstrument(token, {
                type,
                direction,
                amount: Number(amount.replace(",", ".")),
                dueDate,
                counterparty,
              });
              setAmount("");
              setCounterparty("");
              await load();
            }}
          />
        </Card>
      ) : null}
      {items.map((i) => (
        <Card key={i.id}>
          <Text style={ui.cardTitle}>
            {i.type === "CHECK" ? "Çek" : "Senet"} · {i.counterparty}
          </Text>
          <Text>{formatTry(Number(i.amount))}</Text>
          <Text style={ui.meta}>
            {String(i.dueDate).slice(0, 10)} · {i.status} · {i.direction}
          </Text>
          {writable && i.status === "OPEN" ? (
            <Button
              label="Ödendi"
              tone="ghost"
              onPress={async () => {
                if (!token) return;
                await api.updateInstrument(token, i.id, { status: "PAID" });
                await load();
              }}
            />
          ) : null}
        </Card>
      ))}
    </View>
  );
}
