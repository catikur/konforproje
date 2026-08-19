import { appendFormFile, isFormDataBody, type PickedFile } from "./form-file";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001/api";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "FINANS" | "IZLEYICI";
};

export type PeriodReport = {
  year: number;
  month: number;
  actualIncome: number;
  actualExpense: number;
  expectedIncome: number;
  expectedExpense: number;
  actualIncomeNet: number;
  actualIncomeVat: number;
  actualExpenseNet: number;
  actualExpenseVat: number;
  deltaIncome: number;
  deltaExpense: number;
  netActual: number;
  netExpected: number;
  counts: { incomes: number; expenses: number; backlog: number };
  categoryIncome: Array<{ id: string; name: string; color: string; gross: number }>;
  categoryExpense: Array<{ id: string; name: string; color: string; gross: number }>;
  supplierExpense: Array<{ id: string | null; name: string; gross: number }>;
  pendingBacklog: Array<{
    id: string;
    direction: string;
    description: string;
    expectedAmount: number;
    status: string;
    categories: string[];
  }>;
  projects?: Array<{
    id: string | null;
    name: string;
    income: number;
    expense: number;
    net: number;
  }>;
};

export type TrendPoint = {
  year: number;
  month: number;
  actualIncome: number;
  actualExpense: number;
  expectedIncome: number;
  expectedExpense: number;
  netActual: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type TokenStore = {
  access: string | null;
  refresh: string | null;
  setTokens?: (access: string | null, refresh: string | null) => void;
};

export const tokenStore: TokenStore = {
  access: null,
  refresh: null,
};

async function parseError(res: Response) {
  const text = await res.text();
  let message = text || res.statusText;
  try {
    const json = JSON.parse(text);
    message = json?.message || json?.error || text;
  } catch {
    /* ignore */
  }
  throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
}

async function refreshAccess(): Promise<string | null> {
  if (!tokenStore.refresh) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokenStore.refresh }),
  });
  if (!res.ok) {
    tokenStore.setTokens?.(null, null);
    return null;
  }
  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  tokenStore.setTokens?.(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null; retry?: boolean } = {},
): Promise<T> {
  const { token, headers, retry = true, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(isFormDataBody(rest.body) ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (res.status === 401 && retry && tokenStore.refresh) {
    const next = await refreshAccess();
    if (next) {
      return request<T>(path, { ...options, token: next, retry: false });
    }
  }
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json() as Promise<T>;
  return undefined as T;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  login: (username: string, password: string) =>
    request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: AuthUser;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
    ),
  logout: (refreshToken?: string | null) =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshToken || undefined }),
    }).catch(() => undefined),
  me: (token: string) => request<AuthUser>("/auth/me", { token }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request("/auth/password", {
      method: "POST",
      token,
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  periodReport: (token: string, year: number, month: number) =>
    request<PeriodReport>(`/reports/period${qs({ year, month })}`, { token }),
  trend: (token: string, months = 12) =>
    request<TrendPoint[]>(`/reports/trend${qs({ months })}`, { token }),
  exportPeriod: async (token: string, year: number, month: number): Promise<Blob> => {
    const res = await fetch(`${API_URL}/reports/period/export${qs({ year, month })}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && tokenStore.refresh) {
      const next = await refreshAccess();
      if (next) return api.exportPeriod(next, year, month);
    }
    if (!res.ok) await parseError(res);
    return res.blob();
  },
  categories: (token: string, activeOnly = true) =>
    request<Array<{ id: string; name: string; type: string; color: string; isActive: boolean }>>(
      `/categories${qs({ activeOnly: activeOnly ? "true" : undefined })}`,
      { token },
    ),
  suppliers: (token: string, activeOnly = true) =>
    request<Array<{ id: string; name: string; taxId?: string | null; isActive: boolean }>>(
      `/suppliers${qs({ activeOnly: activeOnly ? "true" : undefined })}`,
      { token },
    ),
  expenses: (token: string, params: Record<string, string | number | undefined>) =>
    request<Paginated<any>>(`/expenses${qs(params)}`, { token }),
  createExpense: (token: string, body: unknown) =>
    request("/expenses", { method: "POST", token, body: JSON.stringify(body) }),
  updateExpense: (token: string, id: string, body: unknown) =>
    request(`/expenses/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  deleteExpense: (token: string, id: string) =>
    request(`/expenses/${id}`, { method: "DELETE", token }),
  uploadExpenseFile: async (
    token: string,
    expenseId: string,
    file: PickedFile | File,
  ) => {
    const form = new FormData();
    await appendFormFile(form, "file", file, "image/jpeg");
    return request(`/expenses/${expenseId}/attachments`, {
      method: "POST",
      token,
      body: form,
    });
  },
  incomes: (token: string, params: Record<string, string | number | undefined>) =>
    request<Paginated<any>>(`/incomes${qs(params)}`, { token }),
  createIncome: (token: string, body: unknown) =>
    request("/incomes", { method: "POST", token, body: JSON.stringify(body) }),
  updateIncome: (token: string, id: string, body: unknown) =>
    request(`/incomes/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  deleteIncome: (token: string, id: string) =>
    request(`/incomes/${id}`, { method: "DELETE", token }),
  backlog: (token: string, params: Record<string, string | number | undefined>) =>
    request<Paginated<any>>(`/backlog${qs(params)}`, { token }),
  createBacklog: (token: string, body: unknown) =>
    request("/backlog", { method: "POST", token, body: JSON.stringify(body) }),
  updateBacklog: (token: string, id: string, body: unknown) =>
    request(`/backlog/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  deleteBacklog: (token: string, id: string) =>
    request(`/backlog/${id}`, { method: "DELETE", token }),
  copyBacklog: (token: string, body: unknown) =>
    request("/backlog/copy-period", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  linkBacklog: (token: string, id: string, body: unknown) =>
    request(`/backlog/${id}/link`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  users: (token: string) => request<any[]>("/users", { token }),
  createUser: (token: string, body: unknown) =>
    request("/users", { method: "POST", token, body: JSON.stringify(body) }),
  updateUser: (token: string, id: string, body: unknown) =>
    request(`/users/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  createCategory: (token: string, body: unknown) =>
    request("/categories", { method: "POST", token, body: JSON.stringify(body) }),
  updateCategory: (token: string, id: string, body: unknown) =>
    request(`/categories/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  createSupplier: (token: string, body: unknown) =>
    request("/suppliers", { method: "POST", token, body: JSON.stringify(body) }),
  updateSupplier: (token: string, id: string, body: unknown) =>
    request(`/suppliers/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  applyOcr: (token: string, id: string) =>
    request(`/expenses/${id}/ocr/apply`, { method: "POST", token, body: "{}" }),
  decideExpense: (token: string, id: string, approve: boolean) =>
    request(`/expenses/${id}/decide`, {
      method: "POST",
      token,
      body: JSON.stringify({ approve }),
    }),
  projects: (token: string, activeOnly = true) =>
    request<any[]>(`/projects${qs({ activeOnly: activeOnly ? "true" : undefined })}`, { token }),
  createProject: (token: string, body: unknown) =>
    request("/projects", { method: "POST", token, body: JSON.stringify(body) }),
  settings: (token: string) => request<any>("/settings", { token }),
  updateSettings: (token: string, body: unknown) =>
    request("/settings", { method: "PATCH", token, body: JSON.stringify(body) }),
  notifications: (token: string) => request<any[]>("/notifications", { token }),
  unreadCount: (token: string) =>
    request<{ count: number }>("/notifications/unread-count", { token }),
  readNotification: (token: string, id: string) =>
    request(`/notifications/${id}/read`, { method: "PATCH", token, body: "{}" }),
  cashflow: (token: string, year: number, month: number) =>
    request<any[]>(`/reports/cashflow${qs({ year, month })}`, { token }),
  aging: (token: string) => request<any>("/reports/aging", { token }),
  budgetAlerts: (token: string, year: number, month: number) =>
    request<any[]>(`/budgets/alerts${qs({ year, month })}`, { token }),
  createBudget: (token: string, body: unknown) =>
    request("/budgets", { method: "POST", token, body: JSON.stringify(body) }),
  contracts: (token: string) => request<any[]>("/contracts", { token }),
  createContract: (token: string, body: unknown) =>
    request("/contracts", { method: "POST", token, body: JSON.stringify(body) }),
  addCollection: (token: string, id: string, body: unknown) =>
    request(`/contracts/${id}/collections`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  accounts: (token: string) => request<any[]>("/accounts", { token }),
  accountBalances: (token: string) => request<any[]>("/accounts/balances", { token }),
  createAccount: (token: string, body: unknown) =>
    request("/accounts", { method: "POST", token, body: JSON.stringify(body) }),
  instruments: (token: string) => request<any[]>("/instruments", { token }),
  createInstrument: (token: string, body: unknown) =>
    request("/instruments", { method: "POST", token, body: JSON.stringify(body) }),
  updateInstrument: (token: string, id: string, body: unknown) =>
    request(`/instruments/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  recurring: (token: string) => request<any[]>("/recurring", { token }),
  createRecurring: (token: string, body: unknown) =>
    request("/recurring", { method: "POST", token, body: JSON.stringify(body) }),
  generateRecurring: (token: string, year: number, month: number) =>
    request(`/recurring/generate${qs({ year, month })}`, { method: "POST", token, body: "{}" }),
  exportPdf: async (token: string, year: number, month: number): Promise<Blob> => {
    const res = await fetch(
      `${API_URL}/reports/period/pdf${qs({ year, month })}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401 && tokenStore.refresh) {
      const next = await refreshAccess();
      if (next) return api.exportPdf(next, year, month);
    }
    if (!res.ok) await parseError(res);
    return res.blob();
  },
  budgets: (token: string, year: number, month: number) =>
    request<any[]>(`/budgets${qs({ year, month })}`, { token }),
  updateProject: (token: string, id: string, body: unknown) =>
    request(`/projects/${id}`, { method: "PATCH", token, body: JSON.stringify(body) }),
  upcomingInstruments: (token: string) => request<any[]>("/instruments/upcoming", { token }),
  markAllRead: (token: string) =>
    request("/notifications/read-all", { method: "PATCH", token, body: "{}" }),
  importExpenses: async (
    token: string,
    file: PickedFile | File,
  ) => {
    const form = new FormData();
    await appendFormFile(
      form,
      "file",
      file,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return request("/imports/expenses", { method: "POST", token, body: form });
  },
};

export function formatTry(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(n || 0);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function canWrite(role?: AuthUser["role"] | null) {
  return role === "ADMIN" || role === "FINANS";
}

export async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
