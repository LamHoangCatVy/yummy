/**
 * Time helpers matching Python output formats.
 *   datetime.now().isoformat()              -> ISO 8601 with no Z (local time)
 *   datetime.now().strftime("%H:%M:%S")     -> HH:MM:SS
 */
export function nowIso(): string {
  // Python's datetime.now().isoformat() emits local time without timezone.
  // Mirror that here so frontend renders match.
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}000`
  );
}

export function nowHms(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
