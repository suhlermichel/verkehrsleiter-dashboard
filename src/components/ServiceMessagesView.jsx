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
import { usePersistentSort } from '../hooks/usePersistentSort.js';
import { deleteDocument } from '../utils/deleteDocument.js';
import RowActionsMenu from './RowActionsMenu.jsx';

const MESSAGE_TYPES = [
  { value: 'disturbance', label: 'Aktuelle Informationen' },
  { value: 'info', label: 'Organisatorische Informationen' },
];

function emptyForm() {
  return {
    id: null,
    title: '',
    description: '',
    type: 'disturbance',
    isNew: true,
    priority: 'high',
    validFrom: '',
    validTo: '',
    showInTicker: false,
    archived: false,
  };
}

function ServiceMessagesView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const [filterType, setFilterType] = useState('all');
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_service_messages',
    'validFrom',
    'asc',
  );
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'serviceMessages');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Meldungen: ' + err.message);
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

    if (filterType !== 'all') {
      list = list.filter((i) => i.type === filterType);
    }

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '') * dir;
      }
      if (sortBy === 'type') {
        return (a.type || '').localeCompare(b.type || '') * dir;
      }
      if (sortBy === 'priority') {
        return (a.priority || '').localeCompare(b.priority || '') * dir;
      }
      const da = a.validFrom || '';
      const dbv = b.validFrom || '';
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

    if (!form.title) {
      setError('Bitte mindestens einen Titel eingeben.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        description: form.description || '',
        type: form.type || 'disturbance',
        isNew: !!form.isNew,
        priority: form.priority || 'high',
        validFrom: form.validFrom || '',
        validTo: form.validTo || '',
         showInTicker: !!form.showInTicker,
        archived: !!form.archived,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'serviceMessages', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'serviceMessages'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
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
      description: item.description || '',
      type: item.type || 'disturbance',
      isNew: !!item.isNew,
      priority: item.priority || 'high',
      validFrom: item.validFrom || '',
      validTo: item.validTo || '',
      showInTicker: !!item.showInTicker,
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'serviceMessages', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  async function handleDelete(item) {
    try {
      await deleteDocument('serviceMessages', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>Informationen Fahrer-Dashboard</h2>

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
            <select value={filterArchived} onChange={(e) => setFilterArchived(e.target.value)}>
              <option value="active">Nur aktive</option>
              <option value="archived">Nur archivierte</option>
              <option value="all">Alle</option>
            </select>
          </label>
        </div>
        <div className="filter-group">
          <label>
            Typ:
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">Alle</option>
              {MESSAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-group">
          <label>
            Sortieren nach:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="validFrom">Gültig von</option>
              <option value="title">Titel</option>
              <option value="type">Typ</option>
              <option value="priority">Priorität</option>
            </select>
          </label>
          <label>
            Richtung:
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)}>
              <option value="asc">Aufsteigend</option>
              <option value="desc">Absteigend</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <p>Lade Meldungen...</p>}
      {error && <p className="error-text">{error}</p>}

      {showForm ? (
        <div className="list-and-form">
          <section className="list-section">
            <h3>Übersicht</h3>
            <table className="data-table zebra">
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Typ</th>
                  <th>NEU</th>
                  <th>Priorität</th>
                  <th>Ticker</th>
                  <th>Gültig von</th>
                  <th>Gültig bis</th>
                  <th>Beschreibung</th>
                  <th>Archiv</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                    <td>{item.title}</td>
                    <td>
                      {MESSAGE_TYPES.find((t) => t.value === item.type)?.label || item.type || 'Störung'}
                    </td>
                    <td>{item.isNew ? 'Ja' : 'Nein'}</td>
                    <td>{item.priority === 'high' ? 'Hoch' : 'Normal'}</td>
                    <td>{item.showInTicker ? 'Ja' : 'Nein'}</td>
                    <td>{item.validFrom || '–'}</td>
                    <td>{item.validTo || '–'}</td>
                    <td className="notes-cell">{item.description}</td>
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
                    <td colSpan={9}>Keine Einträge vorhanden.</td>
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
                <input name="title" type="text" value={form.title} onChange={handleChange} />
              </label>
              <label>
                Typ
                <select name="type" value={form.type} onChange={handleChange}>
                  {MESSAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Beschreibung
                <textarea
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                />
              </label>
              <label>
                Priorität
                <select name="priority" value={form.priority} onChange={handleChange}>
                  <option value="high">Hoch</option>
                  <option value="normal">Normal</option>
                </select>
              </label>
              <label>
                Gültig von
                <input
                  name="validFrom"
                  type="date"
                  value={form.validFrom}
                  onChange={handleChange}
                />
              </label>
              <label>
                Gültig bis
                <input
                  name="validTo"
                  type="date"
                  value={form.validTo}
                  onChange={handleChange}
                />
              </label>
              <label className="checkbox-label">
                <input
                  name="isNew"
                  type="checkbox"
                  checked={form.isNew}
                  onChange={handleChange}
                />
                Als NEU markieren
              </label>
              <label className="checkbox-label">
                <input
                  name="showInTicker"
                  type="checkbox"
                  checked={form.showInTicker}
                  onChange={handleChange}
                />
                Im Fahrdienst-Ticker anzeigen
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
                <button type="submit">{form.id ? 'Speichern' : 'Anlegen'}</button>
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
                <th>Titel</th>
                <th>Typ</th>
                <th>NEU</th>
                <th>Priorität</th>
                <th>Ticker</th>
                <th>Gültig von</th>
                <th>Gültig bis</th>
                <th>Beschreibung</th>
                <th>Archiv</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>{item.title}</td>
                  <td>
                    {MESSAGE_TYPES.find((t) => t.value === item.type)?.label || item.type || 'Störung'}
                  </td>
                  <td>{item.isNew ? 'Ja' : 'Nein'}</td>
                  <td>{item.priority === 'high' ? 'Hoch' : 'Normal'}</td>
                  <td>{item.showInTicker ? 'Ja' : 'Nein'}</td>
                  <td>{item.validFrom || '–'}</td>
                  <td>{item.validTo || '–'}</td>
                  <td className="notes-cell">{item.description}</td>
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
                  <td colSpan={9}>Keine Einträge vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default ServiceMessagesView;
