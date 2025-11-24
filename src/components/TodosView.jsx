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
import { getTrafficLightForTodo, trafficLightClass } from '../utils/trafficLight.js';

const TODO_PRIORITIES = ['niedrig', 'normal', 'hoch'];

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
    description: '',
    dueDate: '',
    dueTime: '',
    priority: 'normal',
    done: false,
    archived: false,
  };
}

function TodosView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const [filterDone, setFilterDone] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'todos');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der To-Dos: ' + err.message);
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

    if (filterDone === 'done') {
      list = list.filter((i) => i.done);
    } else if (filterDone === 'open') {
      list = list.filter((i) => !i.done);
    }

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'priority') {
        const order = { niedrig: 0, normal: 1, hoch: 2 };
        const av = order[a.priority] ?? 1;
        const bv = order[b.priority] ?? 1;
        return (av - bv) * dir;
      }
      if (sortBy === 'done') {
        const av = a.done ? 1 : 0;
        const bv = b.done ? 1 : 0;
        return (av - bv) * dir;
      }
      const da = a.dueDate || '';
      const dbv = b.dueDate || '';
      return da.localeCompare(dbv) * dir;
    });

    return list;
  }, [items, filterArchived, filterDone, sortBy, sortDirection]);

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

    if (!form.title || !form.dueDate) {
      setError('Bitte mindestens Titel und Fälligkeitsdatum ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        description: form.description || '',
        dueDate: form.dueDate,
        dueTime: form.dueTime || '',
        priority: form.priority || 'normal',
        done: !!form.done,
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'todos', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'todos'), payload);
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
      dueDate: item.dueDate || '',
      dueTime: item.dueTime || '',
      priority: item.priority || 'normal',
      done: !!item.done,
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'todos', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  async function toggleDone(item) {
    try {
      const ref = doc(db, 'todos', item.id);
      await updateDoc(ref, { done: !item.done, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Erledigt-Status: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>To-Dos</h2>

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
          <label>
            Status:
            <select
              value={filterDone}
              onChange={(e) => setFilterDone(e.target.value)}
            >
              <option value="all">Alle</option>
              <option value="open">Nur offene</option>
              <option value="done">Nur erledigte</option>
            </select>
          </label>
        </div>

        <div className="filter-group">
          <label>
            Sortieren nach:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="dueDate">Fälligkeit</option>
              <option value="priority">Priorität</option>
              <option value="done">Erledigt</option>
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

      {loading && <p>Lade To-Dos...</p>}
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
                  <th>Fälligkeit</th>
                  <th>Uhrzeit</th>
                  <th>Priorität</th>
                  <th>Erledigt</th>
                  <th>Archiv</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                    <td>
                      {(() => {
                        const color = getTrafficLightForTodo(item);
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
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{item.dueTime}</td>
                    <td>{item.priority}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!item.done}
                        onChange={() => toggleDone(item)}
                      />
                    </td>
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
              Beschreibung
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
              />
            </label>
            <label>
              Fälligkeitsdatum*
              <input
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
              />
            </label>
            <label>
              Fälligkeitszeit
              <input
                name="dueTime"
                type="text"
                placeholder="z.B. 14:00"
                value={form.dueTime}
                onChange={handleChange}
              />
            </label>
            <label>
              Priorität
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                {TODO_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                name="done"
                type="checkbox"
                checked={form.done}
                onChange={handleChange}
              />
              Bereits erledigt
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
                <th>Fälligkeit</th>
                <th>Uhrzeit</th>
                <th>Priorität</th>
                <th>Erledigt</th>
                <th>Archiv</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>
                    {(() => {
                      const color = getTrafficLightForTodo(item);
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
                  <td>{formatDate(item.dueDate)}</td>
                  <td>{item.dueTime}</td>
                  <td>{item.priority}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!item.done}
                      onChange={() => toggleDone(item)}
                    />
                  </td>
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

export default TodosView;
