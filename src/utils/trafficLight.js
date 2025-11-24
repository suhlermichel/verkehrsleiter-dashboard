const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Schwellwerte für die Ampel bei Abwesenheiten (in Tagen bis zum Ende)
// Rot: Abwesenheit endet in <= 3 Tagen und es gibt keine Rückkehrbestätigung
// Grün: Rückkehr bestätigt oder Ende > 3 Tage entfernt
export const ABSENCE_RED_THRESHOLD_DAYS = 3;
export const ABSENCE_YELLOW_THRESHOLD_DAYS = 7; // aktuell ungenutzt, falls später wieder benötigt

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffInDays(a, b) {
  if (!a || !b) return null;
  const diff = a.getTime() - b.getTime();
  return Math.round(diff / MS_PER_DAY);
}

export function getTrafficLightForAbsence(absence) {
  if (!absence) return 'none';
  if (absence.archived) return 'green';

  const today = toDateOnly(new Date());
  const to = toDateOnly(absence.endDate || absence.startDate);
  const returnDate = toDateOnly(absence.returnDate || null);
  if (!today || !to) return 'none';

  const hasReturnConfirmation = !!returnDate;
  const daysUntilEnd = diffInDays(to, today); // positiv: Ende liegt in der Zukunft

  // Grün, wenn Rückkehr bereits bestätigt ist - unabhängig vom Datum
  if (hasReturnConfirmation) {
    return 'green';
  }

  // Rot: Ende heute oder in den nächsten ABSENCE_RED_THRESHOLD_DAYS Tagen (inkl. überfällig),
  // solange keine Rückkehrbestätigung vorliegt.
  if (
    daysUntilEnd !== null &&
    daysUntilEnd <= ABSENCE_RED_THRESHOLD_DAYS
  ) {
    return 'red';
  }

  // Ehemals Gelb: Ende in (ABSENCE_RED_THRESHOLD_DAYS+1) bis ABSENCE_YELLOW_THRESHOLD_DAYS Tagen,
  // wird aktuell ebenfalls als Grün dargestellt (nur Rot vs. Grün im UI).
  if (
    daysUntilEnd !== null &&
    daysUntilEnd > ABSENCE_RED_THRESHOLD_DAYS &&
    daysUntilEnd <= ABSENCE_YELLOW_THRESHOLD_DAYS
  ) {
    return 'green';
  }

  // Grün: Ende liegt weiter als ABSENCE_YELLOW_THRESHOLD_DAYS Tage in der Zukunft
  // (oder der Wert ist nicht sinnvoll berechenbar, dann ebenfalls grün als Fallback).
  if (daysUntilEnd !== null && daysUntilEnd > ABSENCE_YELLOW_THRESHOLD_DAYS) {
    return 'green';
  }

  return 'green';
}

export function getTrafficLightForRoadwork(roadwork) {
  if (!roadwork) return 'none';
  if (roadwork.archived) return 'green';
  const today = toDateOnly(new Date());
  const from = toDateOnly(roadwork.startDate);
  const to = toDateOnly(roadwork.endDate || roadwork.startDate);
  if (!from || !today) return 'none';

  if (roadwork.status === 'beendet') {
    return 'green';
  }

  const isRunning = from.getTime() <= today.getTime() && today.getTime() <= to.getTime();
  const daysUntilStart = diffInDays(from, today);

  if (isRunning || (daysUntilStart !== null && daysUntilStart >= 0 && daysUntilStart <= 2)) {
    return 'red';
  }

  if (daysUntilStart !== null && daysUntilStart > 2 && daysUntilStart <= 14) {
    return 'yellow';
  }

  return 'green';
}

export function getTrafficLightForCharterTrip(trip) {
  if (!trip) return 'none';
  if (trip.archived) return 'green';
  const today = toDateOnly(new Date());
  const date = toDateOnly(trip.date);
  if (!date || !today) return 'none';

  const days = diffInDays(date, today);
  if (days === 0) return 'red';
  if (days !== null && days > 0) return 'green';
  return 'green';
}

export function getTrafficLightForAppointment(app) {
  if (!app) return 'none';
  if (app.archived) return 'green';
  const today = toDateOnly(new Date());
  const date = toDateOnly(app.date);
  if (!date || !today) return 'none';

  const days = diffInDays(date, today);
  if (days === 0) return 'red';
  return 'green';
}

export function getTrafficLightForTodo(todo) {
  if (!todo) return 'none';
  if (todo.done) return 'green';
  const today = toDateOnly(new Date());
  const due = toDateOnly(todo.dueDate);
  if (!due || !today) return 'none';

  const days = diffInDays(due, today);
  if (days !== null && days <= 0) return 'red';
  return 'green';
}

export function getTrafficLightForTraining(training) {
  if (!training) return 'none';
  if (training.archived) return 'green';
  const today = toDateOnly(new Date());
  const from = toDateOnly(training.dateFrom);
  const to = toDateOnly(training.dateTo || training.dateFrom);
  if (!from || !today) return 'none';

  const isRunning = from.getTime() <= today.getTime() && today.getTime() <= to.getTime();
  const daysUntilStart = diffInDays(from, today);

  if (isRunning || (daysUntilStart !== null && daysUntilStart <= 1)) {
    return 'red';
  }

  return 'green';
}

export function trafficLightClass(color) {
  if (color === 'red') return 'traffic-light-dot traffic-light-red';
  if (color === 'yellow') return 'traffic-light-dot traffic-light-yellow';
  if (color === 'green') return 'traffic-light-dot traffic-light-green';
  return 'traffic-light-dot traffic-light-none';
}
