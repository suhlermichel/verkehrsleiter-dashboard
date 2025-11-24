import { format } from 'date-fns';

// Sehr einfache Feiertagslogik für Thüringen (nur feste Datumsangaben, kein Anspruch auf Vollständigkeit)
// Format: MM-dd
const FIXED_HOLIDAYS = new Set([
  '01-01', // Neujahr
  '05-01', // Tag der Arbeit
  '10-03', // Tag der Deutschen Einheit
  '10-31', // Reformationstag
  '12-25', // 1. Weihnachtstag
  '12-26', // 2. Weihnachtstag
]);

export function isHoliday(date) {
  if (!date) return false;
  const key = format(date, 'MM-dd');
  return FIXED_HOLIDAYS.has(key);
}
