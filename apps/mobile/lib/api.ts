const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001/api";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "FINANS" | "IZLEYICI";
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.message || text;
    } catch {
      /* ignore */
    }
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: (token: string) => request<AuthUser>("/auth/me", { token }),
  periodReport: (token: string, year: number, month: number) =>
    request<{
      year: number;
      month: number;
      actualIncome: number;
      actualExpense: number;
      expectedIncome: number;
      expectedExpense: number;
      deltaIncome: number;
      deltaExpense: number;
      netActual: number;
      netExpected: number;
      counts: { incomes: number; expenses: number; backlog: number };
    }>(`/reports/period?year=${year}&month=${month}`, { token }),
  categories: (token: string) =>
    request<
      Array<{ id: string; name: string; type: string; color: string }>
    >("/categories?activeOnly=true", { token }),
  suppliers: (token: string) =>
    request<Array<{ id: string; name: string }>>(
      "/suppliers?activeOnly=true",
      { token },
    ),
  expenses: (token: string, year: number, month: number) =>
    request<any[]>(`/expenses?year=${year}&month=${month}`, { token }),
  createExpense: (token: string, body: unknown) =>
    request("/expenses", { method: "POST", token, body: JSON.stringify(body) }),
  incomes: (token: string, year: number, month: number) =>
    request<any[]>(`/incomes?year=${year}&month=${month}`, { token }),
  createIncome: (token: string, body: unknown) =>
    request("/incomes", { method: "POST", token, body: JSON.stringify(body) }),
  backlog: (token: string, year: number, month: number) =>
    request<any[]>(`/backlog?year=${year}&month=${month}`, { token }),
  createBacklog: (token: string, body: unknown) =>
    request("/backlog", { method: "POST", token, body: JSON.stringify(body) }),
  users: (token: string) => request<any[]>("/users", { token }),
  createUser: (token: string, body: unknown) =>
    request("/users", { method: "POST", token, body: JSON.stringify(body) }),
  createCategory: (token: string, body: unknown) =>
    request("/categories", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
};

export function formatTry(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(n);
}
