import { truncateText } from './text';

export function buildFullAddress(streetRaw: string, cityRaw: string, stateRaw: string, zipRaw: string) {
  const street = streetRaw.trim();
  const cityPart = cityRaw.trim();
  const statePart = stateRaw.trim();
  const zipPart = zipRaw.trim();
  let line2 = '';
  if (cityPart) {
    line2 += cityPart;
  }
  if (statePart) {
    line2 += line2 ? `, ${statePart}` : statePart;
  }
  if (zipPart) {
    line2 += line2 ? ` ${zipPart}` : zipPart;
  }
  return line2 ? `${street}, ${line2}` : street;
}

export function formatRouteAddress(address?: string | null, max = 26) {
  if (!address) return '';
  const street = address.split(',')[0]?.trim() || '';
  return truncateText(street, max);
}
