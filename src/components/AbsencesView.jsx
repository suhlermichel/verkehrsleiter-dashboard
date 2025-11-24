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
import { getTrafficLightForAbsence, trafficLightClass } from '../utils/trafficLight.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ABSENCE_TYPES = ['kr', 'kru'];
const ABSENCE_STATUS = ['eingetragen', 'verlängert'];

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
    personnelNumber: '',
    type: 'kr',
    startDate: '',
    endDate: '',
    returnDate: '',
    status: 'eingetragen',
    hasPaperCertificate: false,
    enteredUntil: '',
    notes: '',
    archived: false,
  };
}

function AbsencesView() {
  const { canEdit, role } = useAuth();
  const canEditAbsences = role === 'admin' || canEdit('absences');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const [filterType, setFilterType] = useState('all');
  const [filterTraffic, setFilterTraffic] = useState('all'); // all | red | green
  const [sortBy, setSortBy] = useState('startDate');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const colRef = collection(db, 'absences');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Abwesenheiten: ' + err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let list = [...items];

    // Nur Krank-Fälle (kr/kru) anzeigen
    list = list.filter((i) => i.type === 'kr' || i.type === 'kru');

    if (filterArchived === 'active') {
      list = list.filter((i) => !i.archived);
    } else if (filterArchived === 'archived') {
      list = list.filter((i) => i.archived);
    }

    if (filterType !== 'all') {
      list = list.filter((i) => i.type === filterType);
    }

    if (filterTraffic !== 'all') {
      list = list.filter((i) => {
        const color = getTrafficLightForAbsence(i);
        if (filterTraffic === 'red') return color === 'red';
        if (filterTraffic === 'green') return color === 'green';
        return true;
      });
    }

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'personnelNumber') {
        return (a.personnelNumber || '').localeCompare(b.personnelNumber || '') * dir;
      }
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '') * dir;
      }
      const da = a[sortBy] || '';
      const dbv = b[sortBy] || '';
      return da.localeCompare(dbv) * dir;
    });

    return list;
  }, [items, filterArchived, filterType, sortBy, sortDirection]);

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

    if (!form.personnelNumber || !form.startDate || !form.endDate) {
      setError('Bitte mindestens Personalnummer, Von-Datum und Bis-Datum ausfüllen.');
      return;
    }

    try {
      const payload = {
        personnelNumber: form.personnelNumber,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        returnDate: form.returnDate || '',
        status: form.status,
        hasPaperCertificate: form.hasPaperCertificate,
        enteredUntil: form.enteredUntil || '',
        notes: form.notes || '',
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'absences', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'absences'), payload);
      }

      setForm(emptyForm());
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    }
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      personnelNumber: item.personnelNumber || '',
      type: item.type || 'kr',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      returnDate: item.returnDate || '',
      status: item.status || 'eingetragen',
      hasPaperCertificate: !!item.hasPaperCertificate,
      enteredUntil: item.enteredUntil || '',
      notes: item.notes || '',
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'absences', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="section-root">
      <h2>Abwesenheiten-krank</h2>

      <div style={{ marginBottom: '8px' }}>
        {canEditAbsences && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setShowForm(true);
            }}
          >
            Neu anlegen
          </button>
        )}
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
          <label>
            Art:
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Alle</option>
              {ABSENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ampel:
            <select
              value={filterTraffic}
              onChange={(e) => setFilterTraffic(e.target.value)}
            >
              <option value="all">Alle</option>
              <option value="red">Nur akut (rot)</option>
              <option value="green">Nur unproblematisch (grün)</option>
            </select>
          </label>
        </div>

        <div className="filter-group">
          <label>
            Sortieren nach:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="startDate">Von-Datum</option>
              <option value="endDate">Bis-Datum</option>
              <option value="personnelNumber">Personalnummer</option>
              <option value="status">Status</option>
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

      {loading && <p>Lade Abwesenheiten...</p>}
      {error && <p className="error-text">{error}</p>}

      {showForm && canEditAbsences ? (
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
                  <th>Personalnr.</th>
                  <th>Art</th>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>KS Papier</th>
                  <th>Status</th>
                  <th>Im PERDIS eingetragen bis</th>
                  <th>Kommt wieder am</th>
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
                        const color = getTrafficLightForAbsence(item);
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
                    <td>{item.personnelNumber}</td>
                    <td>{item.type}</td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{formatDate(item.endDate)}</td>
                    <td>{item.hasPaperCertificate ? 'Ja' : 'Nein'}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.enteredUntil)}</td>
                    <td>{formatDate(item.returnDate)}</td>
                    <td>{item.notes}</td>
                    <td>{item.archived ? 'Ja' : 'Nein'}</td>
                    <td>
                      {canEditAbsences && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleArchive(item)}
                          >
                            {item.archived ? 'Reaktivieren' : 'Archivieren'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={9}>Keine Einträge gefunden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="form-section">
          <h3>{form.id ? 'Eintrag bearbeiten' : 'Neu anlegen'}</h3>
          <form onSubmit={handleSubmit} className="data-form">
            <label>
              Personalnummer*
              <input
                name="personnelNumber"
                type="text"
                value={form.personnelNumber}
                onChange={handleChange}
              />
            </label>
            <label>
              Art der Abwesenheit*
              <select name="type" value={form.type} onChange={handleChange}>
                {ABSENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Von-Datum*
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
              />
            </label>
            <label>
              Bis-Datum*
              <input
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
              />
            </label>
            <label>
              Kommt wieder am
              <input
                name="returnDate"
                type="date"
                value={form.returnDate}
                onChange={handleChange}
              />
            </label>
            <label>
              Status
              <select name="status" value={form.status} onChange={handleChange}>
                {ABSENCE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                name="hasPaperCertificate"
                type="checkbox"
                checked={form.hasPaperCertificate}
                onChange={handleChange}
              />
              Krankenschein im Papierformat lag vor
            </label>
            <label>
              Im PERDIS eingetragen bis
              <input
                name="enteredUntil"
                type="date"
                value={form.enteredUntil}
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
                <th>Personalnr.</th>
                <th>Art</th>
                <th>Von</th>
                <th>Bis</th>
                <th>KS Papier</th>
                <th>Status</th>
                <th>Im PERDIS eingetragen bis</th>
                <th>Kommt wieder am</th>
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
                      const color = getTrafficLightForAbsence(item);
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
                  <td>{item.personnelNumber}</td>
                  <td>{item.type}</td>
                  <td>{formatDate(item.startDate)}</td>
                  <td>{formatDate(item.endDate)}</td>
                  <td>{item.hasPaperCertificate ? 'Ja' : 'Nein'}</td>
                  <td>{item.status}</td>
                  <td>{formatDate(item.enteredUntil)}</td>
                  <td>{formatDate(item.returnDate)}</td>
                  <td>{item.notes}</td>
                  <td>{item.archived ? 'Ja' : 'Nein'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleArchive(item)}
                    >
                      {item.archived ? 'Reaktivieren' : 'Archivieren'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={9}>Keine Einträge gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default AbsencesView;
