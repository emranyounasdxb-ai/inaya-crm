export class ApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.code ?? (response.status === 401 ? "unauthorized" : "server_error"));
  return result as T;
}
export const errorCode = (error: unknown) =>
  error instanceof ApiError ? error.code : "server_error";
export function dateTime(value: string | null, language: string) {
  return value
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-AE" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Dubai",
      }).format(new Date(value))
    : "—";
}
export function dubaiInput(value: string | null) {
  return value ? new Date(new Date(value).getTime() + 4 * 3600000).toISOString().slice(0, 16) : "";
}
export const fromDubaiInput = (value: string) =>
  value ? new Date(`${value}:00+04:00`).toISOString() : null;
