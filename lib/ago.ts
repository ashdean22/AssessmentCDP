/** Wall-clock arrival age ("12s ago"). Display only; business logic uses REFERENCE_DATE. */
export function ago(receivedAt: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(receivedAt)) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
