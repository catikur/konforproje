import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../lib/auth";
import { api, formatTry } from "../../lib/api";
import { Button, Card, Chip, Field, ui } from "../../components/ui";

export default function AdminScreen() {
  const { token, user } = useAuth();
  const now = new Date();
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "FINANS" | "IZLEYICI">("FINANS");
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"BOTH" | "EXPENSE" | "INCOME">("BOTH");
  const [supplierName, setSupplierName] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"CASH" | "BANK">("CASH");
  const [accountIban, setAccountIban] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [approvalLimit, setApprovalLimit] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetDir, setBudgetDir] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [budgetCategoryId, setBudgetCategoryId] = useState<string | null>(null);
  const [budgetProjectId, setBudgetProjectId] = useState<string | null>(null);
  const [recDesc, setRecDesc] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("1");
  const [recTarget, setRecTarget] = useState<"EXPENSE" | "BACKLOG">("EXPENSE");
  const [recCategoryId, setRecCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    const [u, c, s, p, a, bal, set, bgt, rec] = await Promise.all([
      api.users(token),
      api.categories(token, false),
      api.suppliers(token, false),
      api.projects(token, false),
      api.accounts(token),
      api.accountBalances(token),
      api.settings(token),
      api.budgets(token, now.getFullYear(), now.getMonth() + 1),
      api.recurring(token),
    ]);
    setUsers(u);
    setCategories(c);
    setSuppliers(s);
    setProjects(p);
    setAccounts(a);
    setBalances(bal);
    setSettings(set);
    setCompanyName(set.companyName || "");
    setApprovalLimit(String(set.approvalLimit ?? 0));
    setBudgets(bgt);
    setRecurring(rec);
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
        <Text style={ui.section}>Sistem ayarları</Text>
        <Field placeholder="Şirket unvanı" value={companyName} onChangeText={setCompanyName} />
        <Field
          placeholder="Onay limiti (0 = hepsi otomatik onay)"
          keyboardType="decimal-pad"
          value={approvalLimit}
          onChangeText={setApprovalLimit}
        />
        <Button
          label="Ayarları kaydet"
          onPress={async () => {
            if (!token) return;
            try {
              await api.updateSettings(token, {
                companyName,
                approvalLimit: Number(approvalLimit.replace(",", ".")) || 0,
              });
              setMessage("Ayarlar kaydedildi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
        {settings ? (
          <Text style={ui.meta}>
            Varsayılan KDV %{settings.defaultVatRate} · {settings.defaultCurrency}
          </Text>
        ) : null}
      </Card>

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

      <Card>
        <Text style={ui.section}>Şantiye / proje</Text>
        <Field placeholder="Proje adı" value={projectName} onChangeText={setProjectName} />
        <Field placeholder="Kod (opsiyonel)" value={projectCode} onChangeText={setProjectCode} />
        <Button
          label="Proje ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createProject(token, { name: projectName, code: projectCode || null });
              setProjectName("");
              setProjectCode("");
              setMessage("Proje eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
      </Card>

      <Card>
        <Text style={ui.section}>Banka / kasa</Text>
        <Field placeholder="Hesap adı" value={accountName} onChangeText={setAccountName} />
        <View style={ui.row}>
          <Chip label="Kasa" active={accountType === "CASH"} onPress={() => setAccountType("CASH")} />
          <Chip label="Banka" active={accountType === "BANK"} onPress={() => setAccountType("BANK")} />
        </View>
        <Field placeholder="IBAN (opsiyonel)" value={accountIban} onChangeText={setAccountIban} />
        <Button
          label="Hesap ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createAccount(token, {
                name: accountName,
                type: accountType,
                iban: accountIban || null,
              });
              setAccountName("");
              setAccountIban("");
              setMessage("Hesap eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
        {balances.map((b) => (
          <Text key={b.id} style={ui.meta}>
            {b.name}: {formatTry(Number(b.balance))}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={ui.section}>
          Bu ay bütçe ({now.getMonth() + 1}/{now.getFullYear()})
        </Text>
        <Field placeholder="Limit tutar" keyboardType="decimal-pad" value={budgetAmount} onChangeText={setBudgetAmount} />
        <View style={ui.row}>
          <Chip label="Gider" active={budgetDir === "EXPENSE"} onPress={() => setBudgetDir("EXPENSE")} />
          <Chip label="Gelir" active={budgetDir === "INCOME"} onPress={() => setBudgetDir("INCOME")} />
        </View>
        <View style={ui.row}>
          <Chip label="Tüm kat." active={!budgetCategoryId} onPress={() => setBudgetCategoryId(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} active={budgetCategoryId === c.id} onPress={() => setBudgetCategoryId(c.id)} />
          ))}
        </View>
        <View style={ui.row}>
          <Chip label="Tüm proje" active={!budgetProjectId} onPress={() => setBudgetProjectId(null)} />
          {projects.map((p) => (
            <Chip key={p.id} label={p.name} active={budgetProjectId === p.id} onPress={() => setBudgetProjectId(p.id)} />
          ))}
        </View>
        <Button
          label="Bütçe ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createBudget(token, {
                periodYear: now.getFullYear(),
                periodMonth: now.getMonth() + 1,
                direction: budgetDir,
                amount: Number(budgetAmount.replace(",", ".")),
                categoryId: budgetCategoryId,
                projectId: budgetProjectId,
              });
              setBudgetAmount("");
              setMessage("Bütçe eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
        {budgets.map((b) => (
          <Text key={b.id} style={ui.meta}>
            {b.direction} · {b.category?.name || "Genel"} · {formatTry(Number(b.amount))}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={ui.section}>Tekrarlayan kural</Text>
        <Field placeholder="Açıklama (kira, leasing…)" value={recDesc} onChangeText={setRecDesc} />
        <Field placeholder="Tutar" keyboardType="decimal-pad" value={recAmount} onChangeText={setRecAmount} />
        <Field placeholder="Ayın günü (1-28)" keyboardType="number-pad" value={recDay} onChangeText={setRecDay} />
        <View style={ui.row}>
          <Chip label="Fiili gider" active={recTarget === "EXPENSE"} onPress={() => setRecTarget("EXPENSE")} />
          <Chip label="Backlog" active={recTarget === "BACKLOG"} onPress={() => setRecTarget("BACKLOG")} />
        </View>
        <View style={ui.row}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} active={recCategoryId === c.id} onPress={() => setRecCategoryId(c.id)} />
          ))}
        </View>
        <Button
          label="Kural ekle"
          onPress={async () => {
            if (!token) return;
            try {
              await api.createRecurring(token, {
                description: recDesc,
                amount: Number(recAmount.replace(",", ".")),
                dayOfMonth: Number(recDay) || 1,
                target: recTarget,
                categoryId: recCategoryId,
              });
              setRecDesc("");
              setRecAmount("");
              setMessage("Kural eklendi");
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
        <Button
          label="Bu ayı üret"
          tone="ghost"
          onPress={async () => {
            if (!token) return;
            try {
              const res = (await api.generateRecurring(token, now.getFullYear(), now.getMonth() + 1)) as {
                generated: number;
              };
              setMessage(`${res.generated} tekrarlayan kayıt üretildi`);
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Hata");
            }
          }}
        />
        {recurring.map((r) => (
          <Text key={r.id} style={ui.meta}>
            {r.description} · gün {r.dayOfMonth} · {r.target}
            {r.isActive ? "" : " (pasif)"}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={ui.section}>Excel gider içe aktarma</Text>
        <Text style={ui.hint}>
          Sütunlar: Tarih | Açıklama | Tutar | KDV (0/1/10/20) | INCLUDED/EXCLUDED | Kategori
        </Text>
        <Button
          label="Excel seç"
          onPress={async () => {
            if (!token) return;
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: [
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "application/vnd.ms-excel",
                ],
                copyToCacheDirectory: true,
              });
              if (result.canceled) return;
              const file = result.assets[0];
              const res = (await api.importExpenses(token, {
                uri: file.uri,
                name: file.name,
                mimeType: file.mimeType,
                file: file.file,
              })) as { created: number; errors: string[] };
              setMessage(
                `${res.created} satır aktarıldı${res.errors?.length ? ` · ${res.errors.length} hata` : ""}`,
              );
              await load();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "İçe aktarma başarısız");
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

      <Text style={ui.section}>Projeler</Text>
      {projects.map((p) => (
        <Card key={p.id}>
          <Text style={ui.cardTitle}>{p.name}</Text>
          <Text style={ui.meta}>{p.code || "kod yok"} · {p.isActive ? "aktif" : "pasif"}</Text>
          <Button
            label={p.isActive ? "Pasifleştir" : "Aktifleştir"}
            tone="ghost"
            onPress={async () => {
              if (!token) return;
              await api.updateProject(token, p.id, { isActive: !p.isActive });
              await load();
            }}
          />
        </Card>
      ))}

      <Text style={ui.section}>Hesaplar</Text>
      {accounts.map((a) => (
        <Card key={a.id}>
          <Text style={ui.cardTitle}>{a.name}</Text>
          <Text style={ui.meta}>
            {a.type} · {a.iban || "IBAN yok"} · {a.isActive ? "aktif" : "pasif"}
          </Text>
        </Card>
      ))}
    </View>
  );
}
