// Time helpers.
//
// All persisted timestamps are ISO-8601 UTC strings (matching the schema's
// text columns). Centralizing this keeps the format identical everywhere and
// makes it trivial to inject a fixed clock in tests.

/** The current instant as an ISO-8601 UTC string, e.g. "2026-10-20T12:00:00.000Z". */
export function nowIso(): string {
  return new Date().toISOString();
}
