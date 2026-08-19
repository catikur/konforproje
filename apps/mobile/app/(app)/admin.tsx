import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Button, Card, Chip, Field, ui } from "../../components/ui";

export default function AdminScreen() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "FINANS" | "IZLEYICI">("FINANS");
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"BOTH" | "EXPENSE" | "INCOME">("BOTH");
  const [supplierName, setSupplierName] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    const [u, c, s] = await Promise.all([
      api.users(token),
      api.categories(token, false),
      api.suppliers(token, false),
    ]);
    setUsers(u);
    setCategories(c);
    setSuppliers(s);
  }, [token, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  if (user && !isAdmin) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={ui.wrap}>
      <Text style={ui.title}>Admin bakım</Text>
      {message ? <Text style={ui.msg}>{message}</Text> : null}

      <Card>
        <Text style={ui.section}>Yeni kullanıcı</Text>
        <Field placeholder="Görünen ad" value={displayName} onChangeText={setDisplayName} />
        <Field placeholder="Kullanıcı adı" autoCapitalize="none" value={username} onChangeText={setUsername} />
        <Field placeholder="Şifre" secureTextEntry value={password} onChangeText={setPassword} />
        <View style={ui.row}>
          {(["FINANS", "IZLEYICI", "ADMIN"] as const).map((r) => (
            <Chip key={r} label={r} active={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
        <Button
          label="Kullanıcı oluştur"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createUser(token, { username, password, displayName, role });
              setUsername("");
              setPassword("");
              setDisplayName("");
              setMessage("Kullanıcı oluşturuldu");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
      </Card>

      <Card>
        <Text style={ui.section}>Yeni kategori</Text>
        <Field placeholder="Kategori adı" value={categoryName} onChangeText={setCategoryName} />
        <View style={ui.row}>
          {(["BOTH", "EXPENSE", "INCOME"] as const).map((t) => (
            <Chip key={t} label={t} active={categoryType === t} onPress={() => setCategoryType(t)} />
          ))}
        </View>
        <Button
          label="Kategori ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createCategory(token, {
                name: categoryName,
                type: categoryType,
                color: "#0F766E",
              });
              setCategoryName("");
              setMessage("Kategori eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
      </Card>

      <Card>
        <Text style={ui.section}>Yeni tedarikçi</Text>
        <Field placeholder="Ad" value={supplierName} onChangeText={setSupplierName} />
        <Field placeholder="VKN (opsiyonel)" value={supplierTaxId} onChangeText={setSupplierTaxId} />
        <Button
          label="Tedarikçi ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createSupplier(token, {
                name: supplierName,
                taxId: supplierTaxId || null,
              });
              setSupplierName("");
              setSupplierTaxId("");
              setMessage("Tedarikçi eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
      </Card>

      <Text style={ui.section}>Kullanıcılar</Text>
      <Field placeholder="Şifre sıfırlama (seçilen kullanıcı için)" value={resetPassword} onChangeText={setResetPassword} secureTextEntry />
      {users.map((u) => (
        <Card key={u.id}>
          <Text style={ui.cardTitle}>
            {u.displayName} ({u.username})
          </Text>
          <Text>
            {u.role} · {u.isActive ? "aktif" : "pasif"}
          </Text>
          <View style={ui.row}>
            <Button
              label={u.isActive ? "Pasifleştir" : "Aktifleştir"}
              tone="ghost"
              onPress={async () => {
                if (!token) return;
                await api.updateUser(token, u.id, { isActive: !u.isActive });
                await load();
              }}
            />
            <Button
              label="Şifre sıfırla"
              tone="ghost"
              onPress={async () => {
                if (!token || !resetPassword) {
                  setMessage("Önce yeni şifreyi yazın");
                  return;
                }
                await api.updateUser(token, u.id, { password: resetPassword });
                setResetPassword("");
                setMessage("Şifre sıfırlandı");
              }}
            />
          </View>
        </Card>
      ))}

      <Text style={ui.section}>Kategoriler</Text>
      {categories.map((c) => (
        <Card key={c.id}>
          <Text style={ui.cardTitle}>{c.name}</Text>
          <Text>
            {c.type} · {c.isActive ? "aktif" : "pasif"}
          </Text>
          <Button
            label={c.isActive ? "Pasifleştir" : "Aktifleştir"}
            tone="ghost"
            onPress={async () => {
              if (!token) return;
              await api.updateCategory(token, c.id, { isActive: !c.isActive });
              await load();
            }}
          />
        </Card>
      ))}

      <Text style={ui.section}>Tedarikçiler</Text>
      {suppliers.map((s) => (
        <Card key={s.id}>
          <Text style={ui.cardTitle}>{s.name}</Text>
          <Text style={ui.meta}>{s.taxId || "VKN yok"}</Text>
          <Button
            label={s.isActive ? "Pasifleştir" : "Aktifleştir"}
            tone="ghost"
            onPress={async () => {
              if (!token) return;
              await api.updateSupplier(token, s.id, { isActive: !s.isActive });
              await load();
            }}
          />
        </Card>
      ))}
    </View>
  );
}
