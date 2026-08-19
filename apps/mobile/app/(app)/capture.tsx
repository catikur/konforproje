import { useCallback, useState } from "react";
import { Text, View, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/auth";
import { api, canWrite, todayIso } from "../../lib/api";
import { Button, Card, Chip, Field, ui } from "../../components/ui";

export default function CaptureScreen() {
  const { token, user } = useAuth();
  const writable = canWrite(user?.role);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("Fiş");
  const [amount, setAmount] = useState("1");
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.categories(token).then((cats) => {
        const f = cats.filter((c) => c.type === "EXPENSE" || c.type === "BOTH");
        setCategories(f);
        if (f[0]) setCategoryId(f[0].id);
      });
    }, [token]),
  );

  async function capture(fromLibrary: boolean) {
    if (!token || !categoryId) return;
    let asset: ImagePicker.ImagePickerAsset | undefined;
    if (fromLibrary || Platform.OS === "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMessage("Galeri izni gerekli");
        return;
      }
      const photo = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (photo.canceled) return;
      asset = photo.assets[0];
    } else {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setMessage("Kamera izni gerekli");
        return;
      }
      const photo = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (photo.canceled) return;
      asset = photo.assets[0];
    }
    if (!asset) return;
    try {
      const exp = (await api.createExpense(token, {
        description,
        amount: Number(amount.replace(",", ".")) || 1,
        expenseDate: todayIso(),
        taxMode: "INCLUDED",
        vatRate: 20,
        categoryIds: [categoryId],
      })) as { id: string };
      await api.uploadExpenseFile(token, exp.id, {
        uri: asset.uri,
        name: asset.fileName || "fis.jpg",
        mimeType: asset.mimeType || "image/jpeg",
      });
      setMessage("Fiş yüklendi, OCR çalışıyor. Giderler’den öneriyi onaylayın.");
      router.push("/expenses");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Yükleme başarısız");
    }
  }

  if (!writable) {
    return (
      <View style={ui.wrap}>
        <Text>Bu ekran izleyici için kapalı</Text>
      </View>
    );
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Hızlı fiş</Text>
      <Text style={ui.hint}>Kamera → gider taslağı → OCR önerisi</Text>
      <Card>
        <Field placeholder="Açıklama" value={description} onChangeText={setDescription} />
        <Field placeholder="Tahmini tutar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <View style={ui.row}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
        <Button label="Kamera ile çek" onPress={() => capture(false)} />
        <Button label="Galeriden seç" tone="ghost" onPress={() => capture(true)} />
        {message ? <Text style={ui.msg}>{message}</Text> : null}
      </Card>
    </View>
  );
}
