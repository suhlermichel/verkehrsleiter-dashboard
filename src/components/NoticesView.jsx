import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { deleteDocument } from '../utils/deleteDocument.js'; // zentrale Löschfunktion
import { usePersistentSort } from '../hooks/usePersistentSort.js'; // Sortierzustand merken
import RowActionsMenu from './RowActionsMenu.jsx'; // 3-Punkte-Menü
import { validateFile } from '../utils/attachments.js';

function formatDate(value) {
  if (!value) return '';
  const full = String(value);
  const str = full.includes('T') ? full.split('T')[0] : full;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}.${month}.${year}`;
  }
  return value;
}

const NOTICE_TYPES = ['Dienstanweisung', 'Aushang'];
const TARGET_GROUPS = ['alle', 'Fahrpersonal', 'Werkstatt', 'Verwaltung'];

function emptyForm() {
  return {
    id: null,
    title: '',
    type: 'Dienstanweisung',
    targetGroup: 'alle',
    validFrom: '',
    validTo: '',
    description: '',
    fileUrl: '',
    fileName: '',
    archived: false,
  };
}

function NoticesView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_notices',
    'validFrom',
    'asc',
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const colRef = collection(db, 'notices');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Dienstanweisungen & Aushänge: ' + err.message);
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
      if (sortBy === 'type') {
        return (a.type || '').localeCompare(b.type || '') * dir;
      }
      if (sortBy === 'targetGroup') {
        return (a.targetGroup || '').localeCompare(b.targetGroup || '') * dir;
      }
      const da = a.validFrom || '';
      const dbv = b.validFrom || '';
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

    if (!form.title || !form.validFrom) {
      setError('Bitte mindestens Titel und Gültig-von-Datum ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        type: form.type || 'Dienstanweisung',
        targetGroup: form.targetGroup || 'alle',
        validFrom: form.validFrom,
        validTo: form.validTo || '',
        description: form.description || '',
        fileUrl: form.fileUrl || '',
        fileName: form.fileName || '',
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'notices', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'notices'), payload);
      }

      setForm(emptyForm());
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    }
  }

  function handleEdit(item) {
    setForm({
      id: item.id,
      title: item.title || '',
      type: item.type || 'Dienstanweisung',
      targetGroup: item.targetGroup || 'alle',
      validFrom: item.validFrom || '',
      validTo: item.validTo || '',
      description: item.description || '',
      fileUrl: item.fileUrl || '',
      fileName: item.fileName || '',
      archived: !!item.archived,
    });
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'notices', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  async function handleDelete(item) {
    try {
      // Falls ein Dokument hochgeladen wurde, auch aus dem Storage entfernen
      if (item.fileUrl && item.storagePath) {
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
      await deleteDocument('notices', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError('');
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.ok) {
      setUploadError(validation.error || 'Datei kann nicht hochgeladen werden.');
      return;
    }

    if (!form.id) {
      setUploadError('Bitte speichern Sie den Aushang zuerst, bevor Sie eine Datei hochladen.');
      return;
    }

    try {
      setUploading(true);
      const storagePath = `notices/${form.id}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setForm((prev) => ({
        ...prev,
        fileUrl: url,
        fileName: file.name,
        storagePath,
      }));

      const refDoc = doc(db, 'notices', form.id);
      await updateDoc(refDoc, {
        fileUrl: url,
        fileName: file.name,
        storagePath,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setUploadError('Fehler beim Hochladen der Datei: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleOpenFile(item) {
    if (!item.fileUrl) return;
    window.open(item.fileUrl, '_blank', 'noopener');
  }

  return (
    <div className="section-root">
      <h2>Dienstanweisungen & Aushänge aktuell</h2>

      <div style={{ marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
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
              <option value="validFrom">Gültig von</option>
              <option value="title">Titel</option>
              <option value="type">Typ</option>
              <option value="targetGroup">Zielgruppe</option>
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

      {loading && <p>Lade Dienstanweisungen & Aushänge...</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="list-and-form">
        <section className="list-section">
          <h3>Übersicht</h3>
          <table className="data-table zebra">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Zielgruppe</th>
                <th>Gültig von</th>
                <th>Gültig bis</th>
                <th>Beschreibung</th>
                <th>Dokument</th>
                <th>Archiv</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.targetGroup}</td>
                  <td>{formatDate(item.validFrom)}</td>
                  <td>{formatDate(item.validTo)}</td>
                  <td className="notes-cell">{item.description}</td>
                  <td>
                    {item.fileUrl ? (
                      <button type="button" onClick={() => handleOpenFile(item)}>
                        Ansehen
                      </button>
                    ) : (
                      '–'
                    )}
                  </td>
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
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
              />
            </label>
            <label>
              Typ
              <select name="type" value={form.type} onChange={handleChange}>
                {NOTICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zielgruppe
              <select
                name="targetGroup"
                value={form.targetGroup}
                onChange={handleChange}
              >
                {TARGET_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gültig von*
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
            <label>
              Beschreibung
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
              />
            </label>

            <div className="attachments-section">
              <h4>Dokument (PDF/Bild)</h4>
              {!form.id && (
                <p className="attachments-hint">
                  Bitte speichern Sie den Eintrag zuerst, bevor Sie ein Dokument hochladen.
                </p>
              )}
              {form.id && (
                <>
                  <label className="attachments-upload-label">
                    <span>Datei hochladen</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  {uploading && <p className="attachments-status">Lade Datei hoch...</p>}
                </>
              )}
              {uploadError && <p className="error-text">{uploadError}</p>}

              {form.id && form.fileUrl && (
                <p>
                  Aktuelles Dokument:{' '}
                  <button type="button" onClick={() => handleOpenFile(form)}>
                    {form.fileName || 'Ansehen'}
                  </button>
                </p>
              )}
            </div>

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
                onClick={() => setForm(emptyForm())}
              >
                Schließen
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default NoticesView;
