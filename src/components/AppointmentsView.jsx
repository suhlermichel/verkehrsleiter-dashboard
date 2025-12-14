import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { getTrafficLightForAppointment, trafficLightClass } from '../utils/trafficLight.js';
import { deleteDocument } from '../utils/deleteDocument.js'; // Version 1.7: zentrale Löschfunktion für Termine
import { usePersistentSort } from '../hooks/usePersistentSort.js'; // Version 1.7: Sortierzustand pro Tab merken
import RowActionsMenu from './RowActionsMenu.jsx'; // Version 1.7: 3-Punkte-Menü für Zeilenaktionen

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function emptyForm() {
  return {
    id: null,
    title: '',
    location: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: '',
    notes: '',
    archived: false,
  };
}

function AppointmentsView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  // Version 1.7: Sortierzustand pro Reiter (Termine) in localStorage merken
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_appointments',
    'date',
    'asc',
  );
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'appointments');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Termine: ' + err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = [...items];

    if (filterArchived === 'active') {
      list = list.filter((i) => !i.archived);
    } else if (filterArchived === 'archived') {
      list = list.filter((i) => i.archived);
    }

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '') * dir;
      }
      if (sortBy === 'location') {
        return (a.location || '').localeCompare(b.location || '') * dir;
      }
      const da = a.dateFrom || a.date || '';
      const dbv = b.dateFrom || b.date || '';
      return da.localeCompare(dbv) * dir;
    });

    return list;
  }, [items, filterArchived, sortBy, sortDirection]);

  function handlePrint() {
    alert('Druck wird vorbereitet. Bitte wählen Sie im nächsten Schritt Ihren Drucker aus.');
    window.print();
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || !form.dateFrom || !form.timeFrom) {
      setError('Bitte mindestens Titel, Datum-von und Startzeit ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        location: form.location || '',
        // Abwärtskompatibilität: altes Feld "date" bleibt erhalten und
        // wird mit dem "von"-Datum befüllt. Neue Felder werden zusätzlich
        // gespeichert.
        date: form.dateFrom,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo || '',
        timeFrom: form.timeFrom,
        timeTo: form.timeTo || '',
        notes: form.notes || '',
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'appointments', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'appointments'), payload);
      }

      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    }
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      title: item.title || '',
      location: item.location || '',
      // Falls neue Felder bereits existieren, diese verwenden;
      // ansonsten das alte Feld "date" als von-Datum interpretieren.
      dateFrom: item.dateFrom || item.date || '',
      dateTo: item.dateTo || '',
      timeFrom: item.timeFrom || '',
      timeTo: item.timeTo || '',
      notes: item.notes || '',
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'appointments', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  // Version 1.7: Hard Delete über zentrale deleteDocument-Hilfsfunktion.
  // Hinweis: Für Termine kann eine Archivierung oft sinnvoller sein
  // als ein vollständiger Hard Delete. Die Löschfunktion bleibt dennoch verfügbar.
  async function handleDelete(item) {
    try {
      await deleteDocument('appointments', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>Termine</h2>

      <div style={{ marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setShowForm(true);
          }}
        >
          Neu anlegen
        </button>
        <button
          type="button"
          style={{ marginLeft: '8px' }}
          onClick={handlePrint}
        >
          Drucken
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>
            Archiv-Filter:
            <select
              value={filterArchived}
              onChange={(e) => setFilterArchived(e.target.value)}
            >
              <option value="active">Nur aktive</option>
              <option value="archived">Nur archivierte</option>
              <option value="all">Alle</option>
            </select>
          </label>
        </div>

        <div className="filter-group">
          <label>
            Sortieren nach:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">Datum</option>
              <option value="title">Titel</option>
              <option value="location">Ort</option>
            </select>
          </label>
          <label>
            Richtung:
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
            >
              <option value="asc">Aufsteigend</option>
              <option value="desc">Absteigend</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <p>Lade Termine...</p>}
      {error && <p className="error-text">{error}</p>}

      {showForm ? (
        <div className="list-and-form">
          <section className="list-section">
            <h3>Übersicht</h3>
            <p>
              <span className="traffic-light-dot traffic-light-red" /> akut ·{' '}
              <span className="traffic-light-dot traffic-light-green" /> unproblematisch
            </p>
            <table className="data-table zebra">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Titel</th>
                  <th>Ort</th>
                  <th>Von Datum</th>
                  <th>Bis Datum</th>
                  <th>Zeit</th>
                  <th>Notizen</th>
                  <th>Archiv</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                    <td>
                      {(() => {
                        const color = getTrafficLightForAppointment(item);
                        const title =
                          color === 'red'
                            ? 'akut'
                            : 'unproblematisch';
                        return <span className={trafficLightClass(color)} title={title} />;
                      })()}
                    </td>
                    <td>{item.title}</td>
                    <td>{item.location}</td>
                    <td>{formatDate(item.dateFrom || item.date)}</td>
                    <td>{formatDate(item.dateTo || item.dateFrom || item.date)}</td>
                    <td>
                      {item.timeFrom}
                      {item.timeTo ? ` - ${item.timeTo}` : ''}
                    </td>
                    <td className="notes-cell">{item.notes}</td>
                    <td>{item.archived ? 'Ja' : 'Nein'}</td>
                    <td>
                      <RowActionsMenu
                        onEdit={() => handleEdit(item)}
                        onArchive={() => toggleArchive(item)}
                        onDelete={() => handleDelete(item)}
                        archived={!!item.archived}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={8}>Keine Einträge gefunden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="form-section">
          <h3>{form.id ? 'Eintrag bearbeiten' : 'Neu anlegen'}</h3>
          <form onSubmit={handleSubmit} className="data-form">
            <label>
              Titel*
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
              />
            </label>
            <label>
              Ort
              <input
                name="location"
                type="text"
                value={form.location}
                onChange={handleChange}
              />
            </label>
            <label>
              Datum von*
              <input
                name="dateFrom"
                type="date"
                value={form.dateFrom}
                onChange={handleChange}
              />
            </label>
            <label>
              Datum bis
              <input
                name="dateTo"
                type="date"
                value={form.dateTo}
                onChange={handleChange}
              />
            </label>
            <label>
              Zeit von*
              <input
                name="timeFrom"
                type="text"
                placeholder="z.B. 09:00"
                value={form.timeFrom}
                onChange={handleChange}
              />
            </label>
            <label>
              Zeit bis
              <input
                name="timeTo"
                type="text"
                placeholder="optional, z.B. 10:30"
                value={form.timeTo}
                onChange={handleChange}
              />
            </label>
            <label>
              Notizen
              <textarea
                name="notes"
                rows={3}
                value={form.notes}
                onChange={handleChange}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="archived"
                type="checkbox"
                checked={form.archived}
                onChange={handleChange}
              />
              Direkt als archiviert markieren
            </label>

            <div className="form-buttons">
              <button type="submit">
                {form.id ? 'Speichern' : 'Anlegen'}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(emptyForm())}
                >
                  Abbrechen / Neu
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm());
                  setShowForm(false);
                }}
              >
                Schließen
              </button>
            </div>
          </form>
        </section>
      </div>
      ) : (
        <section className="list-section">
          <h3>Übersicht</h3>
          <p>
            <span className="traffic-light-dot traffic-light-red" /> akut ·{' '}
            <span className="traffic-light-dot traffic-light-green" /> unproblematisch
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Titel</th>
                <th>Ort</th>
                <th>Von Datum</th>
                <th>Bis Datum</th>
                <th>Zeit</th>
                <th>Notizen</th>
                <th>Archiv</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>
                    {(() => {
                      const color = getTrafficLightForAppointment(item);
                      const title =
                        color === 'red'
                          ? 'akut'
                          : color === 'yellow'
                          ? 'bald relevant'
                          : color === 'green'
                          ? 'unproblematisch'
                          : '';
                      return <span className={trafficLightClass(color)} title={title} />;
                    })()}
                  </td>
                  <td>{item.title}</td>
                  <td>{item.location}</td>
                  <td>{formatDate(item.dateFrom || item.date)}</td>
                  <td>{formatDate(item.dateTo || item.dateFrom || item.date)}</td>
                  <td>
                    {item.timeFrom}
                    {item.timeTo ? ` - ${item.timeTo}` : ''}
                  </td>
                  <td className="notes-cell">{item.notes}</td>
                  <td>{item.archived ? 'Ja' : 'Nein'}</td>
                  <td>
                    <RowActionsMenu
                      onEdit={() => handleEdit(item)}
                      onArchive={() => toggleArchive(item)}
                      onDelete={() => handleDelete(item)}
                      archived={!!item.archived}
                    />
                  </td>
                </tr>
              ))}
              {!loading && filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={7}>Keine Einträge gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default AppointmentsView;
