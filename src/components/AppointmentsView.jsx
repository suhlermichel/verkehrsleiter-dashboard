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
    date: '',
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
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('asc');
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
      const da = a.date || '';
      const dbv = b.date || '';
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

    if (!form.title || !form.date || !form.timeFrom) {
      setError('Bitte mindestens Titel, Datum und Startzeit ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        location: form.location || '',
        date: form.date,
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
      date: item.date || '',
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
                  <th>Datum</th>
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
                    <td>{formatDate(item.date)}</td>
                    <td>
                      {item.timeFrom}
                      {item.timeTo ? ` - ${item.timeTo}` : ''}
                    </td>
                    <td>{item.notes}</td>
                    <td>{item.archived ? 'Ja' : 'Nein'}</td>
                    <td>
                      <button type="button" onClick={() => handleEdit(item)}>
                        Bearbeiten
                      </button>
                      <button type="button" onClick={() => toggleArchive(item)}>
                        {item.archived ? 'Reaktivieren' : 'Archivieren'}
                      </button>
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
              Datum*
              <input
                name="date"
                type="date"
                value={form.date}
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
                <th>Datum</th>
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
                  <td>{formatDate(item.date)}</td>
                  <td>
                    {item.timeFrom}
                    {item.timeTo ? ` - ${item.timeTo}` : ''}
                  </td>
                  <td>{item.notes}</td>
                  <td>{item.archived ? 'Ja' : 'Nein'}</td>
                  <td>
                    <button type="button" onClick={() => handleEdit(item)}>
                      Bearbeiten
                    </button>
                    <button type="button" onClick={() => toggleArchive(item)}>
                      {item.archived ? 'Reaktivieren' : 'Archivieren'}
                    </button>
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
