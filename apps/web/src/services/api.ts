// Typed fetch client for the Pixel Race API.
//
// Attaches the JWT from localStorage to every request, normalizes the shared
// ApiError envelope into a thrown ApiRequestError, and signals an expired
// session (401) so the auth layer can log the user out and redirect. The base
// URL comes from the Vite env (VITE_API_BASE_URL) with a dev default.

import type {
  ApiError,
  AuthResponse,
  CarColor,
  CreateGuessResponse,
  HistoryEntry,
  LeaderboardEntry,
  LeaderboardPeriod,
  LoginRequest,
  Paginated,
  Race,
  RegisterRequest,
  SettleResult,
  User,
  UserStats,
} from '@pixel-race/shared-types';

const TOKEN_KEY = 'pixel-race.token';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

/** Error thrown for any non-2xx response, carrying the API's code + message. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }

  /** True when the failure is an authentication/expired-session error. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

// --- Token storage (localStorage) -----------------------------------------

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// --- Core request ----------------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Whether to attach the stored bearer token (default true). */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = options.auth === false ? null : getToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const envelope = payload as ApiError | null;
    const code = envelope?.error?.code ?? 'REQUEST_FAILED';
    const message = envelope?.error?.message ?? `Request failed (${response.status})`;
    throw new ApiRequestError(response.status, code, message);
  }

  return payload as T;
}

// --- Endpoint helpers ------------------------------------------------------

export const api = {
  register: (input: RegisterRequest) =>
    request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: input, auth: false }),

  login: (input: LoginRequest) =>
    request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: input, auth: false }),

  me: () => request<User>('/api/v1/users/me'),

  stats: () => request<UserStats>('/api/v1/users/me/stats'),

  history: (page: number, pageSize: number) =>
    request<Paginated<HistoryEntry>>(`/api/v1/users/me/history?page=${page}&pageSize=${pageSize}`),

  createRace: () => request<Race>('/api/v1/races', { method: 'POST' }),

  currentRace: () => request<Race>('/api/v1/races/current'),

  getRace: (raceId: string) => request<Race>(`/api/v1/races/${raceId}`),

  startRace: (raceId: string) => request<Race>(`/api/v1/races/${raceId}/start`, { method: 'POST' }),

  submitGuess: (raceId: string, guessedColor: CarColor) =>
    request<CreateGuessResponse>(`/api/v1/races/${raceId}/guesses`, {
      method: 'POST',
      body: { guessedColor },
    }),

  settleRace: (raceId: string) =>
    request<SettleResult>(`/api/v1/races/${raceId}/settle`, { method: 'POST' }),

  leaderboard: (period: LeaderboardPeriod, page: number, pageSize: number) =>
    request<Paginated<LeaderboardEntry>>(
      `/api/v1/leaderboard?period=${period}&page=${page}&pageSize=${pageSize}`,
    ),
};
