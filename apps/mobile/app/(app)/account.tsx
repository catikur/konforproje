import { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Button, Card, Field, ui } from "../../components/ui";

export default function AccountScreen() {
  const { user, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!token) return;
    try {
      await api.changePassword(token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Şifre güncellendi. Yeni oturumlar için tekrar giriş gerekir.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Hata");
    }
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Hesap</Text>
      <Card>
        <Text style={ui.cardTitle}>{user?.displayName}</Text>
        <Text style={ui.meta}>
          {user?.username} · {user?.role}
        </Text>
      </Card>
      <Card>
        <Text style={ui.section}>Şifre değiştir</Text>
        <Field
          placeholder="Mevcut şifre"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Field
          placeholder="Yeni şifre (min 6)"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Button label="Kaydet" onPress={save} />
        {message ? <Text style={ui.msg}>{message}</Text> : null}
      </Card>
    </View>
  );
}
