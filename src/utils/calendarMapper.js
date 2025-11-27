import { addDays, parseISO } from 'date-fns';

// Hilfsfunktion: ISO-String oder "YYYY-MM-DD" sicher in Date umwandeln
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    // Firestore speichert unsere Datumsfelder als String "YYYY-MM-DD"
    return parseISO(String(value));
  } catch {
    return null;
  }
}

function baseEvent({ id, title, start, end, type, source }) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate) return null;

  // Damit der letzte Tag im Kalenderbalken enthalten ist, +1 Tag
  const endInclusive = endDate ? addDays(endDate, 1) : addDays(startDate, 1);

  return {
    id,
    title,
    start: startDate,
    end: endInclusive,
    type,
    resource: source,
  };
}

export function mapAbsencesToEvents(absences) {
  return absences
    .map((a) =>
      baseEvent({
        id: `absence-${a.id}`,
        title: `Abwesenheit ${a.personnelNumber || ''} (${a.type || ''})`,
        start: a.startDate,
        end: a.endDate,
        type: 'absence',
        source: a,
      }),
    )
    .filter(Boolean);
}

export function mapMedicalAppointmentsToEvents(medicalAppointments) {
  return medicalAppointments
    .map((m) =>
      baseEvent({
        id: `medical-${m.id}`,
        title: m.personalNumber ? `Betriebsarzt: ${m.personalNumber}` : 'Termin Betriebsarzt',
        start: m.date,
        end: m.date,
        type: 'medical',
        source: m,
      }),
    )
    .filter(Boolean);
}

export function mapAppointmentsToEvents(appointments) {
  return appointments
    .map((a) =>
      baseEvent({
        id: `appointment-${a.id}`,
        title: a.title || 'Termin',
        start: a.date,
        end: a.date,
        type: 'appointment',
        source: a,
      }),
    )
    .filter(Boolean);
}

export function mapTodosToEvents(todos) {
  return todos
    .filter((t) => t.dueDate)
    .map((t) =>
      baseEvent({
        id: `todo-${t.id}`,
        title: t.title || 'To-Do',
        start: t.dueDate,
        end: t.dueDate,
        type: 'todo',
        source: t,
      }),
    )
    .filter(Boolean);
}

export function mapTrainingsToEvents(trainings) {
  return trainings
    .map((tr) =>
      baseEvent({
        id: `training-${tr.id}`,
        title: tr.title || 'Schulung',
        start: tr.dateFrom,
        end: tr.dateFrom,
        type: 'training',
        source: tr,
      }),
    )
    .filter(Boolean);
}

export function mapRoadworksToEvents(roadworks) {
  return roadworks
    .map((r) =>
      baseEvent({
        id: `roadwork-${r.id}`,
        title: r.title ? `Baustelle: ${r.title}` : 'Baustelle',
        start: r.startDate,
        end: r.endDate,
        type: 'roadwork',
        source: r,
      }),
    )
    .filter(Boolean);
}

export function mapCharterTripsToEvents(trips) {
  return trips
    .map((t) =>
      baseEvent({
        id: `charter-${t.id}`,
        // Version 1.7: Ort/Ziel und ggf. Fahrzeugart im Titel anzeigen und
        // bei gesetztem Rückfahrtdatum einen Spann von Hin- bis Rückfahrt darstellen.
        title: (() => {
          const parts = [];
          if (t.label) parts.push(t.label);
          if (t.destination) parts.push(t.destination);
          if (t.vehicleType) parts.push(t.vehicleType);
          const base = parts.join(' • ');
          return base ? `Fahrt: ${base}` : 'Gelegenheitsfahrt';
        })(),
        start: t.date,
        end: t.returnDate || t.date,
        type: 'charter',
        source: t,
      }),
    )
    .filter(Boolean);
}
