import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Button, Card, ui } from "../../components/ui";

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setItems(await api.notifications(token));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Bildirimler</Text>
      {items.length ? (
        <Button
          label="Tümünü okundu işaretle"
          tone="ghost"
          onPress={async () => {
            if (!token) return;
            await api.markAllRead(token);
            await load();
          }}
        />
      ) : null}
      {items.map((n) => (
        <Card key={n.id}>
          <Text style={ui.cardTitle}>{n.title}</Text>
          <Text>{n.body}</Text>
          <Text style={ui.meta}>{String(n.createdAt).slice(0, 16)}</Text>
          {!n.readAt && token ? (
            <Button
              label="Okundu"
              tone="ghost"
              onPress={async () => {
                await api.readNotification(token, n.id);
                await load();
              }}
            />
          ) : null}
        </Card>
      ))}
      {!items.length ? <Text style={ui.hint}>Bildirim yok</Text> : null}
    </View>
  );
}
