type HasName = { name?: string | null };

function splitName(value?: string | null) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { last: '', first: '' };
  if (parts.length === 1) return { last: parts[0], first: '' };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') };
}

export function sortByLastName<T extends HasName>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aParts = splitName(a.name);
    const bParts = splitName(b.name);
    const lastCmp = aParts.last.localeCompare(bParts.last, undefined, { sensitivity: 'base' });
    if (lastCmp !== 0) return lastCmp;
    return aParts.first.localeCompare(bParts.first, undefined, { sensitivity: 'base' });
  });
}
