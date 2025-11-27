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
import { deleteDocument } from '../utils/deleteDocument.js'; // Version 1.7: zentrale Löschfunktion für Betriebsarzt-Termine
import { usePersistentSort } from '../hooks/usePersistentSort.js'; // Version 1.7: Sortierzustand pro Tab merken
import RowActionsMenu from './RowActionsMenu.jsx'; // Version 1.7: 3-Punkte-Menü für Zeilenaktionen

function formatDate(value) {
  if (!value) return '';
  // Erwartetes Format aus dem Formular ist "YYYY-MM-DD".
  // Wir formatieren rein über String-Operationen, um Zeitzonenprobleme
  // (Verschiebung um einen Tag) zu vermeiden.
  const full = String(value);
  const str = full.includes('T') ? full.split('T')[0] : full;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}.${month}.${year}`;
  }
  return value;
}

function emptyForm() {
  return {
    id: null,
    date: '',
    time: '',
    personalNumber: '',
    location: '',
    notes: '',
    archived: false,
  };
}

function MedicalAppointmentsView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  // Version 1.7: Sortierzustand pro Reiter (Termine Betriebsarzt) in localStorage merken
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_medicalAppointments',
    'date',
    'asc',
  );
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'medicalAppointments');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Betriebsarzt-Termine: ' + err.message);
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
      if (sortBy === 'personalNumber') {
        return (a.personalNumber || '').localeCompare(b.personalNumber || '') * dir;
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

    if (!form.date || !form.time || !form.personalNumber) {
      setError('Bitte mindestens Datum, Uhrzeit und Personalnummer ausfüllen.');
      return;
    }

    try {
      const payload = {
        date: form.date,
        time: form.time,
        personalNumber: form.personalNumber,
        location: form.location || '',
        notes: form.notes || '',
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'medicalAppointments', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'medicalAppointments'), payload);
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
      date: item.date || '',
      time: item.time || '',
      personalNumber: item.personalNumber || '',
      location: item.location || '',
      notes: item.notes || '',
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'medicalAppointments', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  // Hard Delete über zentrale deleteDocument-Hilfsfunktion.
  async function handleDelete(item) {
    try {
      await deleteDocument('medicalAppointments', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>Termine Betriebsarzt</h2>

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
              <option value="personalNumber">Personalnummer</option>
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

      {loading && <p>Lade Termine Betriebsarzt...</p>}
      {error && <p className="error-text">{error}</p>}

      {showForm ? (
        <div className="list-and-form">
          <section className="list-section">
            <h3>Übersicht</h3>
            <table className="data-table zebra">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Uhrzeit</th>
                  <th>Personalnummer</th>
                  <th>Ort</th>
                  <th>Bemerkung</th>
                  <th>Archiv</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.time}</td>
                    <td>{item.personalNumber}</td>
                    <td>{item.location}</td>
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
                    <td colSpan={7}>Keine Einträge vorhanden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="form-section">
            <h3>{form.id ? 'Eintrag bearbeiten' : 'Neu anlegen'}</h3>
            <form onSubmit={handleSubmit} className="data-form">
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
                Uhrzeit*
                <input
                  name="time"
                  type="time"
                  value={form.time}
                  onChange={handleChange}
                />
              </label>
              <label>
                Personalnummer*
                <input
                  name="personalNumber"
                  type="text"
                  value={form.personalNumber}
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
                Bemerkung
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
          <table className="data-table zebra">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Uhrzeit</th>
                <th>Personalnummer</th>
                <th>Ort</th>
                <th>Bemerkung</th>
                <th>Archiv</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.time}</td>
                  <td>{item.personalNumber}</td>
                  <td>{item.location}</td>
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
                  <td colSpan={7}>Keine Einträge vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default MedicalAppointmentsView;
