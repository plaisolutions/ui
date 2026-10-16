import { afterEach, describe, expect, it, vi } from "vitest"
import { HttpStatusError, normalizeError } from "../errors"

describe("HTTP errors", () => {
  afterEach(() => vi.useRealTimers())

  it("exposes a spending cap without adding a new error type", () => {
    const cause = new HttpStatusError(
      403,
      "Forbidden",
      JSON.stringify({
        code: "spending_cap_exceeded",
        detail: "Monthly limit reached",
        period_end: "2026-11-01T00:00:00Z",
      }),
    )
    expect(normalizeError(cause)).toEqual({
      type: "http_error",
      status: 403,
      code: "spending_cap_exceeded",
      message: "HTTP 403 Forbidden: Monthly limit reached",
      periodEnd: "2026-11-01T00:00:00Z",
      cause,
    })
  })

  it.each([
    "spending_cap_accounting_incomplete",
    "spending_cap_state_unavailable",
  ])("retains %s", (code) => {
    expect(
      normalizeError(
        new HttpStatusError(
          503,
          "Unavailable",
          JSON.stringify({ code, detail: "Try later" }),
        ),
      ),
    ).toMatchObject({
      status: 503,
      code,
      message: "HTTP 503 Unavailable: Try later",
    })
  })

  it("prefers the validated body retry delay over the header", () => {
    expect(
      normalizeError(
        new HttpStatusError(
          429,
          "Too Many Requests",
          '{"code":"rate_limit_exceeded","retry_after_seconds":12}',
          { "Retry-After": "30" },
        ),
      ),
    ).toMatchObject({
      code: "rate_limit_exceeded",
      retryAfterSeconds: 12,
      status: 429,
    })
  })

  it("supports Retry-After dates and legacy responses without a code", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-16T10:00:00Z"))
    expect(
      normalizeError(
        new HttpStatusError(429, "Too Many Requests", "", {
          "Retry-After": "Fri, 16 Oct 2026 10:00:30 GMT",
        }),
      ),
    ).toMatchObject({ retryAfterSeconds: 30 })
    expect(
      normalizeError(
        new HttpStatusError(401, "Unauthorized", '{"detail":"Token expired"}'),
      ),
    ).toMatchObject({
      status: 401,
      message: "HTTP 401 Unauthorized: Token expired",
    })
  })

  it.each(["", "<html>upstream failure</html>", "not json", "[]", "null"])(
    "uses a safe fallback for %j",
    (body) => {
      const error = normalizeError(
        new HttpStatusError(503, "Service Unavailable", body),
      )
      expect(error.message).toBe("HTTP 503 Service Unavailable")
      expect(error.code).toBeUndefined()
    },
  )

  it("supports FastAPI nested detail and validates optional fields", () => {
    expect(
      normalizeError(
        new HttpStatusError(
          403,
          "Forbidden",
          '{"detail":{"code":"spending_cap_exceeded","detail":"Blocked"}}',
        ),
      ),
    ).toMatchObject({
      code: "spending_cap_exceeded",
      message: "HTTP 403 Forbidden: Blocked",
    })
    const error = normalizeError(
      new HttpStatusError(
        403,
        "Forbidden",
        '{"code":{},"detail":[],"period_end":"bad","retry_after_seconds":-1}',
        { "Retry-After": "-2" },
      ),
    )
    expect(error.code).toBeUndefined()
    expect(error.periodEnd).toBeUndefined()
    expect(error.retryAfterSeconds).toBeUndefined()
    // A permission failure must never be inferred to be a spending cap.
    expect(
      normalizeError(new HttpStatusError(403, "Forbidden", "")).code,
    ).toBeUndefined()
  })
})
