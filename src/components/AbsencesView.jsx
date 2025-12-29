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
import { deleteDocument } from '../utils/deleteDocument.js'; // Version 1.7: zentrale Löschfunktion
import { usePersistentSort } from '../hooks/usePersistentSort.js'; // Version 1.7: Sortierzustand pro Tab merken
import RowActionsMenu from './RowActionsMenu.jsx'; // Version 1.7: 3-Punkte-Menü für Zeilenaktionen

const ABSENCE_TYPES = ['kr', 'kru'];

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
    isNew: false,
    isExtended: false,
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
  // Version 1.7: Sortierzustand pro Reiter (Abwesenheiten) in localStorage merken
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_absences',
    'startDate',
    'asc',
  );

  useEffect(() => {
    const colRef = collection(db, 'absences');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);

        // Migration: ältere Einträge, bei denen der Status noch "verlängert" lautet,
        // auf den neuen Mechanismus umstellen: Status auf "eingetragen" setzen und
        // isExtended aktivieren, damit die Verlängerung visuell über das Badge bleibt.
        data
          .filter((item) => item.status === 'verlängert')
          .forEach((item) => {
            try {
              const ref = doc(db, 'absences', item.id);
              updateDoc(ref, {
                status: 'eingetragen',
                isExtended: item.isExtended ?? true,
                updatedAt: serverTimestamp(),
              });
            } catch {
              // Migrationsfehler hier bewusst ignorieren; Datensatz bleibt dann unverändert.
            }
          });
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
        status: form.status || 'eingetragen',
        isNew: !!form.isNew,
        isExtended: !!form.isExtended,
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
      isNew: !!item.isNew,
      isExtended: !!item.isExtended,
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

  // Version 1.7: Hard Delete über zentrale deleteDocument-Hilfsfunktion
  async function handleDelete(item) {
    try {
      await deleteDocument('absences', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  function handlePrint() {
    alert('Druck wird vorbereitet. Bitte wählen Sie im nächsten Schritt Ihren Drucker aus.');
    window.print();
  }

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
              <option value="enteredUntil">Im PERDIS eingetragen bis</option>
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
                    <td
                      style={item.hasPaperCertificate ? {} : { color: 'red' }}
                      title={
                        item.hasPaperCertificate
                          ? undefined
                          : 'Es liegt kein Krankenschein im Papierformat vor.'
                      }
                    >
                      {item.hasPaperCertificate ? 'Ja' : 'Nein'}
                    </td>
                    <td>
                      <span>{item.status || 'eingetragen'}</span>
                      {item.isNew && (
                        <span className="absence-badge absence-badge-new">NEU</span>
                      )}
                      {item.isExtended && !item.isNew && (
                        <span className="absence-badge absence-badge-extended">VERLÄNGERT</span>
                      )}
                    </td>
                    <td
                      className="perdis-until-cell"
                      style={(() => {
                        // Version 1.7: Perdis-Abweichungslogik
                        // Wenn Krank-Fall (kr/kru) UND enteredUntil gesetzt UND
                        // enteredUntil vom Enddatum abweicht, Schrift in ROT darstellen.
                        const isSick = item.type === 'kr' || item.type === 'kru';
                        const hasEntered = !!item.enteredUntil;
                        const differs =
                          item.enteredUntil && item.endDate && item.enteredUntil !== item.endDate;
                        if (isSick && hasEntered && differs) {
                          return { color: 'red' };
                        }
                        return {};
                      })()}
                      title={(() => {
                        const isSick = item.type === 'kr' || item.type === 'kru';
                        const hasEntered = !!item.enteredUntil;
                        const differs =
                          item.enteredUntil && item.endDate && item.enteredUntil !== item.endDate;
                        return isSick && hasEntered && differs
                          ? 'Eintragung in PERDIS weicht vom Ende des Krankenscheins ab.'
                          : undefined;
                      })()}
                    >
                      {formatDate(item.enteredUntil)}
                    </td>
                    <td>{formatDate(item.returnDate)}</td>
                    <td className="notes-cell">{item.notes}</td>
                    <td>{item.archived ? 'Ja' : 'Nein'}</td>
                    <td>
                      {canEditAbsences && (
                        <RowActionsMenu
                          onEdit={() => handleEdit(item)}
                          onArchive={() => toggleArchive(item)}
                          onDelete={() => handleDelete(item)}
                          archived={!!item.archived}
                        />
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
            <label className="checkbox-label">
              <input
                name="hasPaperCertificate"
                type="checkbox"
                checked={form.hasPaperCertificate}
                onChange={handleChange}
              />
              Krankenschein im Papierformat lag vor
            </label>
            <label className="checkbox-label">
              <input
                name="isNew"
                type="checkbox"
                checked={!!form.isNew}
                onChange={handleChange}
              />
              Eintrag im Dashboard als NEU hervorheben
            </label>
            <label className="checkbox-label">
              <input
                name="isExtended"
                type="checkbox"
                checked={!!form.isExtended}
                onChange={handleChange}
              />
              Eintrag im Dashboard als VERLÄNGERT hervorheben
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
          <table className="data-table zebra">
            <thead>
              <tr>
                <th>Ampel</th>
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
                  <td
                    style={item.hasPaperCertificate ? {} : { color: 'red' }}
                    title={
                      item.hasPaperCertificate
                        ? undefined
                        : 'Es liegt kein Krankenschein im Papierformat vor.'
                    }
                  >
                    {item.hasPaperCertificate ? 'Ja' : 'Nein'}
                  </td>
                  <td>
                    <span>{item.status || 'eingetragen'}</span>
                    {item.isNew && (
                      <span className="absence-badge absence-badge-new">NEU</span>
                    )}
                    {item.isExtended && !item.isNew && (
                      <span className="absence-badge absence-badge-extended">VERLÄNGERT</span>
                    )}
                  </td>
                  <td
                    className="perdis-until-cell"
                    style={(() => {
                      // Version 1.7: Perdis-Abweichungslogik (siehe Erklärung weiter oben).
                      const isSick = item.type === 'kr' || item.type === 'kru';
                      const hasEntered = !!item.enteredUntil;
                      const differs =
                        item.enteredUntil && item.endDate && item.enteredUntil !== item.endDate;
                      if (isSick && hasEntered && differs) {
                        return { color: 'red' };
                      }
                      return {};
                    })()}
                    title={(() => {
                      const isSick = item.type === 'kr' || item.type === 'kru';
                      const hasEntered = !!item.enteredUntil;
                      const differs =
                        item.enteredUntil && item.endDate && item.enteredUntil !== item.endDate;
                      return isSick && hasEntered && differs
                        ? 'Eintragung in PERDIS weicht vom Ende des Krankenscheins ab.'
                        : undefined;
                    })()}
                  >
                    {formatDate(item.enteredUntil)}
                  </td>
                  <td>{formatDate(item.returnDate)}</td>
                  <td className="notes-cell">{item.notes}</td>
                  <td>{item.archived ? 'Ja' : 'Nein'}</td>
                  <td>
                    {canEditAbsences && (
                      <RowActionsMenu
                        onEdit={() => handleEdit(item)}
                        onArchive={() => toggleArchive(item)}
                        onDelete={() => handleDelete(item)}
                        archived={!!item.archived}
                      />
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
      )}
    </div>
  );
}

export default AbsencesView;
