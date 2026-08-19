import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api, canWrite, formatTry, todayIso } from "../../lib/api";
import { Button, Card, Field, ui } from "../../components/ui";

export default function ContractsScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [collectId, setCollectId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setItems(await api.contracts(token));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Hakediş / Sözleşme</Text>
      {writable ? (
        <Card>
          <Field placeholder="Sözleşme adı" value={name} onChangeText={setName} />
          <Field placeholder="Karşı taraf" value={counterparty} onChangeText={setCounterparty} />
          <Field placeholder="Bedel" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Button
            label="Ekle"
            onPress={async () => {
              if (!token) return;
              await api.createContract(token, {
                name,
                counterparty,
                contractAmount: Number(amount.replace(",", ".")),
              });
              setName("");
              setCounterparty("");
              setAmount("");
              await load();
            }}
          />
        </Card>
      ) : null}
      {items.map((c) => (
        <Card key={c.id}>
          <Text style={ui.cardTitle}>{c.name}</Text>
          <Text>{c.counterparty}</Text>
          <Text>Bedel {formatTry(Number(c.contractAmount))}</Text>
          <Text>Tahsil {formatTry(Number(c.collected))}</Text>
          <Text>Kalan {formatTry(Number(c.remaining))}</Text>
          {writable ? (
            <>
              <Field
                placeholder="Tahsilat tutarı"
                keyboardType="decimal-pad"
                value={collectId === c.id ? collectAmount : ""}
                onChangeText={(t) => {
                  setCollectId(c.id);
                  setCollectAmount(t);
                }}
              />
              <Button
                label="Tahsilat ekle"
                tone="ghost"
                onPress={async () => {
                  if (!token) return;
                  await api.addCollection(token, c.id, {
                    amount: Number(collectAmount.replace(",", ".")),
                    collectedAt: todayIso(),
                  });
                  setCollectAmount("");
                  await load();
                }}
              />
            </>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
