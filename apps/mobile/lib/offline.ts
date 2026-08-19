import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const KEY = "konfor_offline_expenses";

export type OfflineDraft = {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  taxMode: "INCLUDED" | "EXCLUDED";
  vatRate: number;
  categoryIds: string[];
  supplierId?: string | null;
  projectId?: string | null;
};

export async function queueExpense(draft: Omit<OfflineDraft, "id">) {
  const list = await listDrafts();
  list.push({ ...draft, id: `off-${Date.now()}` });
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function listDrafts(): Promise<OfflineDraft[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as OfflineDraft[]) : [];
}

export async function flushDrafts(token: string) {
  const list = await listDrafts();
  const remain: OfflineDraft[] = [];
  let synced = 0;
  for (const d of list) {
    try {
      await api.createExpense(token, d);
      synced += 1;
    } catch {
      remain.push(d);
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(remain));
  return { synced, remaining: remain.length };
}
