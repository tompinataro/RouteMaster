export function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    // Prefer Intl formatting without seconds; fallback to manual
    try {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' } as any);
    } catch {
      const hh = d.getHours();
      const mm = `${d.getMinutes()}`.padStart(2, '0');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${mm} ${ampm}`;
    }
  } catch {
    return '—';
  }
}

