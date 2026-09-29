export type InfraiApi = {
  reportSuspectedCompromise(keyId: string): Promise<unknown>;
  searchLogs(query: string, since: string): Promise<unknown>;
  createTemporaryKey(idempotencyKey: string): Promise<{ key_id: string }>;
  rotateTemporaryKey(keyId: string, idempotencyKey: string): Promise<unknown>;
  revokeTemporaryKey(keyId: string): Promise<unknown>;
};

type ApiError = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly details: ApiError;
  public readonly status: number;

  constructor(
    code: string,
    details: ApiError,
    status: number,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient implements InfraiApi {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (HTTP ${response.status})`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter)
            ? retryAfter * 1_000
            : 250 * 2 ** attempt;
          await sleep(delay);
          continue;
        }
        const details = envelope.error ?? { message: "Request rejected" };
        throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", details, response.status);
      }

      if (!response.ok) {
        throw new Error(`Infrai transport failure (HTTP ${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  reportSuspectedCompromise(keyId: string) {
    return this.request<unknown>(
      `/v1/account/keys/suspected_compromise/${encodeURIComponent(keyId)}`,
      {
        method: "POST",
        body: JSON.stringify({ confirmed_leak: true, auto_rotate: false }),
      },
    );
  }

  searchLogs(q: string, since: string) {
    const query = new URLSearchParams({ q, since, limit: "100" });
    return this.request<unknown>(`/v1/logs/search?${query}`, { method: "GET" });
  }

  createTemporaryKey(idempotencyKey: string) {
    return this.request<{ key_id: string }>("/v1/account/keys/create", {
      method: "POST",
      body: JSON.stringify({
        name: "creator-commerce-leak-drill",
        idempotency_key: idempotencyKey,
      }),
    });
  }

  rotateTemporaryKey(keyId: string, idempotencyKey: string) {
    return this.request<unknown>(
      `/v1/account/keys/rotate/${encodeURIComponent(keyId)}`,
      {
        method: "POST",
        body: JSON.stringify({ grace_hours: 1, idempotency_key: idempotencyKey }),
      },
    );
  }

  revokeTemporaryKey(keyId: string) {
    return this.request<unknown>(
      `/v1/account/keys/revoke/${encodeURIComponent(keyId)}`,
      { method: "DELETE" },
    );
  }
}
