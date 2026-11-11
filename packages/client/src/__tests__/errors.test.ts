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

  it("exposes the field errors of a rejected edit", () => {
    const cause = new HttpStatusError(
      422,
      "Unprocessable Entity",
      JSON.stringify({
        detail: {
          code: "invalid_tool_decision",
          detail: "invalid edit of action a-1",
          action_id: "a-1",
          errors: [
            { field: "to", message: "needs at least one recipient" },
            { field: 1, message: "ignored: field is not a string" },
          ],
        },
      }),
    )

    expect(normalizeError(cause)).toMatchObject({
      type: "http_error",
      status: 422,
      code: "invalid_tool_decision",
      toolDecision: {
        actionId: "a-1",
        errors: [{ field: "to", message: "needs at least one recipient" }],
      },
    })
    // Without an action id or a list there is nothing to attach.
    expect(
      normalizeError(
        new HttpStatusError(
          422,
          "x",
          '{"code":"invalid_tool_decision","errors":[]}',
        ),
      ).toolDecision,
    ).toBeUndefined()
  })

  it("keeps the stable code of each field error and ignores a malformed one", () => {
    const cause = new HttpStatusError(
      422,
      "Unprocessable Entity",
      JSON.stringify({
        detail: {
          code: "invalid_tool_decision",
          action_id: "a-1",
          errors: [
            {
              field: "to",
              code: "needs_recipient",
              message: "needs at least one recipient",
            },
            { field: "body", message: "an older server sends no code" },
            { field: "x", code: 5, message: "code is not a string" },
          ],
        },
      }),
    )

    expect(normalizeError(cause).toolDecision?.errors).toEqual([
      {
        field: "to",
        code: "needs_recipient",
        message: "needs at least one recipient",
      },
      { field: "body", message: "an older server sends no code" },
      { field: "x", message: "code is not a string" },
    ])
  })

  it("exposes a conflict on a submission's key, with the run that applies it", () => {
    const inProgress = normalizeError(
      new HttpStatusError(
        409,
        "Conflict",
        JSON.stringify({
          detail: {
            code: "decision_in_progress",
            detail: "this submission is already being applied",
            execution_id: "run-1",
          },
        }),
      ),
    )
    const early = normalizeError(
      new HttpStatusError(
        409,
        "Conflict",
        JSON.stringify({
          detail: { code: "decision_in_progress", execution_id: null },
        }),
      ),
    )
    const conflict = normalizeError(
      new HttpStatusError(
        409,
        "Conflict",
        JSON.stringify({ detail: { code: "decision_request_conflict" } }),
      ),
    )

    expect(inProgress.toolSubmission).toEqual({
      code: "decision_in_progress",
      executionId: "run-1",
    })
    expect(early.toolSubmission).toEqual({
      code: "decision_in_progress",
      executionId: null,
    })
    expect(conflict.toolSubmission).toEqual({
      code: "decision_request_conflict",
      executionId: null,
    })
  })

  it("does not take any other 409 for a submission conflict", () => {
    const busy = normalizeError(
      new HttpStatusError(
        409,
        "Conflict",
        JSON.stringify({ detail: { code: "thread_busy", detail: "running" } }),
      ),
    )

    expect(busy.code).toBe("thread_busy")
    expect(busy.toolSubmission).toBeUndefined()
  })

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
