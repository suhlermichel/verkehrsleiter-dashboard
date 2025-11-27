import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import de from 'date-fns/locale/de';
import { db } from '../firebase.js';
import {
  mapAbsencesToEvents,
  mapRoadworksToEvents,
  mapCharterTripsToEvents,
  mapAppointmentsToEvents,
  mapMedicalAppointmentsToEvents,
  mapTodosToEvents,
  mapTrainingsToEvents,
} from '../utils/calendarMapper.js';
import { isHoliday } from '../utils/holidays.js';

const locales = {
  de,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

function getStoredBool(key, defaultValue) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function CalendarView() {
  const [absences, setAbsences] = useState([]);
  const [roadworks, setRoadworks] = useState([]);
  const [charterTrips, setCharterTrips] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medicalAppointments, setMedicalAppointments] = useState([]);
  const [todos, setTodos] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [showAbsences, setShowAbsences] = useState(() =>
    getStoredBool('cal_show_absences', true),
  );
  const [showRoadworks, setShowRoadworks] = useState(() =>
    getStoredBool('cal_show_roadworks', true),
  );
  const [showCharter, setShowCharter] = useState(() =>
    getStoredBool('cal_show_charter', true),
  );
  const [showAppointments, setShowAppointments] = useState(() =>
    getStoredBool('cal_show_appointments', true),
  );
  const [showMedicalAppointments, setShowMedicalAppointments] = useState(() =>
    getStoredBool('cal_show_medicalAppointments', true),
  );
  const [showTodos, setShowTodos] = useState(() =>
    getStoredBool('cal_show_todos', true),
  );
  const [showTrainings, setShowTrainings] = useState(() =>
    getStoredBool('cal_show_trainings', true),
  );
  const [showArchived, setShowArchived] = useState(() =>
    getStoredBool('cal_show_archived', false),
  );
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const unsubAbs = onSnapshot(collection(db, 'absences'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAbsences(data);
    });

    const unsubRoad = onSnapshot(collection(db, 'roadworks'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRoadworks(data);
    });

    const unsubTrips = onSnapshot(collection(db, 'charterTrips'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCharterTrips(data);
    });

    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppointments(data);
    });

    const unsubMedicalAppointments = onSnapshot(
      collection(db, 'medicalAppointments'),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMedicalAppointments(data);
      },
    );

    const unsubTodos = onSnapshot(collection(db, 'todos'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTodos(data);
    });

    const unsubTrainings = onSnapshot(collection(db, 'trainings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTrainings(data);
    });

    return () => {
      unsubAbs();
      unsubRoad();
      unsubTrips();
      unsubAppointments();
      unsubMedicalAppointments();
      unsubTodos();
      unsubTrainings();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('cal_show_absences', String(showAbsences));
      window.localStorage.setItem('cal_show_roadworks', String(showRoadworks));
      window.localStorage.setItem('cal_show_charter', String(showCharter));
      window.localStorage.setItem('cal_show_appointments', String(showAppointments));
      window.localStorage.setItem(
        'cal_show_medicalAppointments',
        String(showMedicalAppointments),
      );
      window.localStorage.setItem('cal_show_todos', String(showTodos));
      window.localStorage.setItem('cal_show_trainings', String(showTrainings));
      window.localStorage.setItem('cal_show_archived', String(showArchived));
    } catch {
      // ignore
    }
  }, [
    showAbsences,
    showRoadworks,
    showCharter,
    showAppointments,
    showMedicalAppointments,
    showTodos,
    showTrainings,
    showArchived,
  ]);

  const events = useMemo(() => {
    const filterArchived = (items) =>
      items.filter((i) => (showArchived ? true : !i.archived));

    let all = [];
    if (showAbsences) {
      all = all.concat(mapAbsencesToEvents(filterArchived(absences)));
    }
    if (showRoadworks) {
      all = all.concat(mapRoadworksToEvents(filterArchived(roadworks)));
    }
    if (showCharter) {
      all = all.concat(mapCharterTripsToEvents(filterArchived(charterTrips)));
    }
    if (showAppointments) {
      all = all.concat(mapAppointmentsToEvents(filterArchived(appointments)));
    }
    if (showMedicalAppointments) {
      all = all.concat(
        mapMedicalAppointmentsToEvents(filterArchived(medicalAppointments)),
      );
    }
    if (showTodos) {
      all = all.concat(mapTodosToEvents(filterArchived(todos)));
    }
    if (showTrainings) {
      all = all.concat(mapTrainingsToEvents(filterArchived(trainings)));
    }
    return all;
  }, [
    absences,
    roadworks,
    charterTrips,
    appointments,
    todos,
    trainings,
    medicalAppointments,
    showAbsences,
    showRoadworks,
    showCharter,
    showAppointments,
    showMedicalAppointments,
    showTodos,
    showTrainings,
    showArchived,
  ]);

  function eventStyleGetter(event) {
    const base = {
      borderRadius: '6px',
      border: 'none',
      color: 'white',
      padding: '2px 4px',
      fontSize: '11px',
    };
    if (event.type === 'absence') {
      const status = event.resource?.status || '';
      if (status === 'verlängert') {
        return { style: { ...base, backgroundColor: '#1d4ed8' } }; // dunkleres Blau für verlängert
      }
      return { style: { ...base, backgroundColor: '#0ea5e9' } }; // blau
    }
    if (event.type === 'roadwork') {
      return { style: { ...base, backgroundColor: '#f97316' } }; // orange
    }
    if (event.type === 'charter') {
      return { style: { ...base, backgroundColor: '#8b5cf6' } }; // violett
    }
    if (event.type === 'appointment') {
      return { style: { ...base, backgroundColor: '#22c55e' } }; // grün
    }
    if (event.type === 'medical') {
      return { style: { ...base, backgroundColor: '#0ea5e9' } }; // blau für Betriebsarzt-Termine
    }
    if (event.type === 'todo') {
      return { style: { ...base, backgroundColor: '#ef4444' } }; // rot
    }
    if (event.type === 'training') {
      return { style: { ...base, backgroundColor: '#eab308' } }; // gelb
    }
    return { style: base };
  }

  function dayPropGetter(date) {
    const day = date.getDay();
    const isSat = day === 6;
    const isSun = day === 0;
    const holiday = isHoliday(date);

    const style = {};
    if (holiday) {
      style.backgroundColor = '#fef9c3'; // gelb
    } else if (isSun) {
      style.backgroundColor = '#fee2e2'; // rot
    } else if (isSat) {
      style.backgroundColor = '#dcfce7'; // grün
    }
    return { style };
  }

  // Hinweis: Im Kalender werden bewusst KEINE Ampel-/Traffic-Light-Indikatoren gerendert,
  // um Version 1.5.1 ohne zusätzliche Dringlichkeitsanzeige zu halten.
  // Falls später gewünscht, könnte man hier z.B. vor dem Text einen farbigen Punkt
  // auf Basis der getTrafficLight*-Funktionen aus utils/trafficLight.js einfügen.
  function renderEvent(event) {
    if (event.type === 'absence') {
      return <span>{event.resource?.personnelNumber || ''} ({event.resource?.type})</span>;
    }
    if (event.type === 'roadwork') {
      return <span>{event.resource?.title || 'Baustelle'}</span>;
    }
    if (event.type === 'charter') {
      return <span>{event.resource?.label || 'Fahrt'}</span>;
    }
    if (event.type === 'appointment') {
      const a = event.resource || {};
      const timeText = a.timeFrom
        ? a.timeTo
          ? `${a.timeFrom}-${a.timeTo}`
          : a.timeFrom
        : '';
      return <span>{timeText ? `${a.title || 'Termin'} (${timeText})` : a.title || 'Termin'}</span>;
    }
    if (event.type === 'medical') {
      const m = event.resource || {};
      const timeText = m.time || '';
      const baseTitle = `Betriebsarzt ${m.personalNumber || ''}`.trim();
      return <span>{timeText ? `${baseTitle} (${timeText})` : baseTitle}</span>;
    }
    if (event.type === 'todo') {
      return <span>{event.resource?.title || 'To-Do'}</span>;
    }
    if (event.type === 'training') {
      const tr = event.resource || {};
      return <span>{tr.title || 'Schulung'}</span>;
    }
    return <span>{event.title}</span>;
  }

  function closeModal() {
    setSelectedEvent(null);
  }

  return (
    <div className="section-root">
      <h2>Kalender-Übersicht</h2>
      <p className="calendar-subtitle">
        Alle Abwesenheiten, Baustellen und Gelegenheitsfahrten auf einen Blick
      </p>

      <div className="calendar-filters-card">
        <h3 className="calendar-filters-title">Filter nach Kategorie:</h3>
        <div className="calendar-filters-row">
          <label className="filter-chip">
            <span className="filter-dot filter-dot-roadwork" />
            <input
              type="checkbox"
              checked={showRoadworks}
              onChange={(e) => setShowRoadworks(e.target.checked)}
            />
            Baustellen
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-absence" />
            <input
              type="checkbox"
              checked={showAbsences}
              onChange={(e) => setShowAbsences(e.target.checked)}
            />
            Abwesenheiten
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-charter" />
            <input
              type="checkbox"
              checked={showCharter}
              onChange={(e) => setShowCharter(e.target.checked)}
            />
            Fahrten
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-appointment" />
            <input
              type="checkbox"
              checked={showAppointments}
              onChange={(e) => setShowAppointments(e.target.checked)}
            />
            Termine
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-appointment" />
            <input
              type="checkbox"
              checked={showMedicalAppointments}
              onChange={(e) => setShowMedicalAppointments(e.target.checked)}
            />
            Termine Betriebsarzt
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-todo" />
            <input
              type="checkbox"
              checked={showTodos}
              onChange={(e) => setShowTodos(e.target.checked)}
            />
            To-Dos
          </label>
          <label className="filter-chip">
            <span className="filter-dot filter-dot-training" />
            <input
              type="checkbox"
              checked={showTrainings}
              onChange={(e) => setShowTrainings(e.target.checked)}
            />
            Schulungen
          </label>
        </div>
        <div className="calendar-filters-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archivierte anzeigen
          </label>
        </div>
      </div>

      <div className="calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 650, backgroundColor: '#ffffff', borderRadius: 16, padding: 12 }}
          defaultView="month"
          views={{ month: true, week: true, day: true }}
          popup
          onSelectEvent={(event) => setSelectedEvent(event)}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          culture="de"
        />
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot legend-dot-roadwork" /> Baustellen
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-absence" /> Abwesenheiten
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-absence-extended" /> Abwesenheiten (verlängert)
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-charter" /> Fahrten
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-appointment" /> Termine
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-appointment" /> Termine Betriebsarzt
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-todo" /> To-Dos
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot-training" /> Schulungen
        </div>
        <div className="legend-item legend-note">
          <span className="legend-dot legend-dot-saturday" /> Samstag (grün),{' '}
          <span className="legend-dot legend-dot-sunday" /> Sonntag (rot),{' '}
          <span className="legend-dot legend-dot-holiday" /> Feiertag (gelb)
        </div>
      </div>

      {selectedEvent && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Details</h3>
              <button type="button" onClick={closeModal}>
                Schließen
              </button>
            </div>
            <div className="modal-body">
              {selectedEvent.type === 'absence' && (
                <>
                  <p>
                    <strong>Personalnummer:</strong> {selectedEvent.resource?.personnelNumber}
                  </p>
                  <p>
                    <strong>Art:</strong> {selectedEvent.resource?.type}
                  </p>
                  <p>
                    <strong>Von/Bis:</strong> {selectedEvent.resource?.startDate} -{' '}
                    {selectedEvent.resource?.endDate}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedEvent.resource?.status}
                  </p>
                  <p>
                    <strong>Im Personalprogramm eingetragen bis:</strong>{' '}
                    {selectedEvent.resource?.enteredUntil || '-'}
                  </p>
                  <p>
                    <strong>Notizen:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'medical' && (
                <>
                  <p>
                    <strong>Personalnummer:</strong>{' '}
                    {selectedEvent.resource?.personalNumber || '-'}
                  </p>
                  <p>
                    <strong>Datum:</strong> {selectedEvent.resource?.date || '-'}
                  </p>
                  <p>
                    <strong>Uhrzeit:</strong> {selectedEvent.resource?.time || '-'}
                  </p>
                  <p>
                    <strong>Ort:</strong> {selectedEvent.resource?.location || '-'}
                  </p>
                  <p>
                    <strong>Bemerkung:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'appointment' && (
                <>
                  <p>
                    <strong>Titel:</strong> {selectedEvent.resource?.title}
                  </p>
                  <p>
                    <strong>Ort:</strong> {selectedEvent.resource?.location || '-'}
                  </p>
                  <p>
                    <strong>Datum:</strong> {selectedEvent.resource?.date || '-'}
                  </p>
                  <p>
                    <strong>Zeit:</strong>{' '}
                    {selectedEvent.resource?.timeFrom || '-'}
                    {selectedEvent.resource?.timeTo
                      ? ` - ${selectedEvent.resource.timeTo}`
                      : ''}
                  </p>
                  <p>
                    <strong>Notizen:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'todo' && (
                <>
                  <p>
                    <strong>Titel:</strong> {selectedEvent.resource?.title}
                  </p>
                  <p>
                    <strong>Beschreibung:</strong> {selectedEvent.resource?.description || '-'}
                  </p>
                  <p>
                    <strong>Fälligkeitsdatum:</strong> {selectedEvent.resource?.dueDate || '-'}
                  </p>
                  <p>
                    <strong>Uhrzeit:</strong> {selectedEvent.resource?.dueTime || '-'}
                  </p>
                  <p>
                    <strong>Priorität:</strong> {selectedEvent.resource?.priority || '-'}
                  </p>
                  <p>
                    <strong>Erledigt:</strong> {selectedEvent.resource?.done ? 'Ja' : 'Nein'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'training' && (
                <>
                  <p>
                    <strong>Titel:</strong> {selectedEvent.resource?.title}
                  </p>
                  <p>
                    <strong>Zeitraum:</strong> {selectedEvent.resource?.dateFrom || '-'}
                  </p>
                  <p>
                    <strong>Uhrzeit:</strong>{' '}
                    {selectedEvent.resource?.timeFrom || '-'}
                    {selectedEvent.resource?.timeTo
                      ? ` - ${selectedEvent.resource.timeTo}`
                      : ''}
                  </p>
                  <p>
                    <strong>Zielgruppe:</strong> {selectedEvent.resource?.targetGroup || '-'}
                  </p>
                  <p>
                    <strong>Notizen:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'roadwork' && (
                <>
                  <p>
                    <strong>Titel:</strong> {selectedEvent.resource?.title}
                  </p>
                  <p>
                    <strong>Ort:</strong> {selectedEvent.resource?.location}
                  </p>
                  <p>
                    <strong>Linien:</strong> {(selectedEvent.resource?.lines || []).join(', ')}
                  </p>
                  <p>
                    <strong>Von/Bis:</strong> {selectedEvent.resource?.startDate} -{' '}
                    {selectedEvent.resource?.endDate}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedEvent.resource?.status}
                  </p>
                  <p>
                    <strong>Notizen:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}

              {selectedEvent.type === 'charter' && (
                <>
                  <p>
                    <strong>Bezeichnung:</strong> {selectedEvent.resource?.label}
                  </p>
                  <p>
                    <strong>Datum:</strong> {selectedEvent.resource?.date}
                  </p>
                  <p>
                    <strong>Uhrzeit Hinfahrt / Rückfahrt:</strong>{' '}
                    {selectedEvent.resource?.outboundTime || '-'} /{' '}
                    {selectedEvent.resource?.returnTime || '-'}
                  </p>
                  <p>
                    <strong>Anzahl Personen:</strong>{' '}
                    {selectedEvent.resource?.passengerCount ?? '-'}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedEvent.resource?.status}
                  </p>
                  <p>
                    <strong>Notizen:</strong> {selectedEvent.resource?.notes || '-'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;
