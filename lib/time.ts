export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
