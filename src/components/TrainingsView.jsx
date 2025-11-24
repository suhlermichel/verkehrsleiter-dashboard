import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, storage } from '../firebase.js';
import { getTrafficLightForTraining, trafficLightClass } from '../utils/trafficLight.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { validateFile, createAttachmentMetadata } from '../utils/attachments.js';

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
    targetGroup: '',
    dateFrom: '',
    timeFrom: '',
    timeTo: '',
    notes: '',
    archived: false,
  };
}

function TrainingsView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const [sortBy, setSortBy] = useState('dateFrom');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showForm, setShowForm] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'trainings');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Schulungen: ' + err.message);
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
      const da = a.dateFrom || '';
      const dbv = b.dateFrom || '';
      return da.localeCompare(dbv) * dir;
    });

    return list;
  }, [items, filterArchived, sortBy, sortDirection]);

  const activeTraining = useMemo(
    () => items.find((i) => i.id === form.id),
    [items, form.id],
  );

  const activeAttachments = activeTraining?.attachments || [];

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleAttachmentUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError('');
    if (!form.id) {
      setUploadError('Bitte speichern Sie die Schulung zuerst, bevor Sie Dokumente hochladen.');
      return;
    }
    const validation = validateFile(file);
    if (!validation.ok) {
      setUploadError(validation.error || 'Datei kann nicht hochgeladen werden.');
      return;
    }

    try {
      setUploading(true);
      const attachmentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storagePath = `trainings/${form.id}/attachments/${attachmentId}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const meta = createAttachmentMetadata({
        id: attachmentId,
        file,
        url,
        storagePath,
        fileType: validation.fileType,
        uploadedAt: new Date().toISOString(),
      });

      const current = activeAttachments || [];
      const refDoc = doc(db, 'trainings', form.id);
      await updateDoc(refDoc, {
        attachments: [...current, meta],
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setUploadError('Fehler beim Hochladen der Datei: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAttachmentDelete(att) {
    setUploadError('');
    if (!form.id) return;
    try {
      if (att.storagePath) {
        const storageRef = ref(storage, att.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
      const remaining = activeAttachments.filter((a) => a.id !== att.id);
      const refDoc = doc(db, 'trainings', form.id);
      await updateDoc(refDoc, {
        attachments: remaining,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setUploadError('Fehler beim Löschen des Anhangs: ' + err.message);
    }
  }

  function handleAttachmentOpen(att) {
    if (!att?.fileUrl) return;
    window.open(att.fileUrl, '_blank', 'noopener');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || !form.dateFrom) {
      setError('Bitte mindestens Titel und Beginn-Datum ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        targetGroup: form.targetGroup || '',
        dateFrom: form.dateFrom,
        timeFrom: form.timeFrom || '',
        timeTo: form.timeTo || '',
        notes: form.notes || '',
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'trainings', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'trainings'), payload);
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
      targetGroup: item.targetGroup || '',
      dateFrom: item.dateFrom || '',
      timeFrom: item.timeFrom || '',
      timeTo: item.timeTo || '',
      notes: item.notes || '',
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'trainings', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>Schulungen</h2>

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
              <option value="dateFrom">Beginn-Datum</option>
              <option value="title">Titel</option>
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

      {loading && <p>Lade Schulungen...</p>}
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
                  <th>Datum</th>
                  <th>Uhrzeit</th>
                  <th>Zielgruppe</th>
                  <th>Notizen</th>
                  <th>Archiv</th>
                  <th>Dokumente</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                    <td>
                      {(() => {
                        const color = getTrafficLightForTraining(item);
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
                    <td>{formatDate(item.dateFrom)}</td>
                    <td>
                      {item.timeFrom}
                      {item.timeTo ? ` - ${item.timeTo}` : ''}
                    </td>
                    <td>{item.targetGroup}</td>
                    <td>{item.notes}</td>
                    <td>{item.archived ? 'Ja' : 'Nein'}</td>
                    <td>
                      {(item.attachments || []).length === 0 && '–'}
                      {(item.attachments || []).length > 0 && (
                        <span>
                          {(item.attachments || []).map((att, index) => (
                            <span
                              key={att.id || index}
                              className="attachment-name"
                              onClick={() => handleAttachmentOpen(att)}
                              style={{ cursor: 'pointer', textDecoration: 'underline', display: 'inline-block' }}
                            >
                              {att.fileName || 'Dokument'}
                              {index < (item.attachments || []).length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
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
              Zielgruppe
              <input
                name="targetGroup"
                type="text"
                placeholder="z.B. Fahrpersonal, Werkstatt"
                value={form.targetGroup}
                onChange={handleChange}
              />
            </label>
            <label>
              Datum der Schulung*
              <input
                name="dateFrom"
                type="date"
                value={form.dateFrom}
                onChange={handleChange}
              />
            </label>
            <label>
              Uhrzeit von
              <input
                name="timeFrom"
                type="text"
                placeholder="z.B. 09:00"
                value={form.timeFrom}
                onChange={handleChange}
              />
            </label>
            <label>
              Uhrzeit bis
              <input
                name="timeTo"
                type="text"
                placeholder="z.B. 12:30"
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

            <div className="attachments-section">
              <h4>Dokumente / Anhänge</h4>
              {!form.id && (
                <p className="attachments-hint">
                  Bitte speichern Sie die Schulung zuerst, bevor Sie Anhänge hochladen.
                </p>
              )}
              {form.id && (
                <>
                  <label className="attachments-upload-label">
                    <span>Datei hochladen (PDF, PNG, JPG, max. 10 MB)</span>
                    <input
                      type="file"
                      onChange={handleAttachmentUpload}
                      disabled={uploading}
                    />
                  </label>
                  {uploading && <p className="attachments-status">Lade Datei hoch...</p>}
                </>
              )}
              {uploadError && <p className="error-text">{uploadError}</p>}

              {form.id && (
                <div className="attachments-list">
                  {activeAttachments.length === 0 && (
                    <p className="attachments-empty">Noch keine Anhänge vorhanden.</p>
                  )}
                  {activeAttachments.map((att) => (
                    <div key={att.id} className="attachment-item">
                      <div className="attachment-main">
                        <span className="attachment-name" onClick={() => handleAttachmentOpen(att)}>
                          {att.fileName}
                        </span>
                        <span className="attachment-type">{att.fileType}</span>
                      </div>
                      <div className="attachment-actions">
                        <button type="button" onClick={() => handleAttachmentOpen(att)}>
                          Ansehen
                        </button>
                        <button type="button" onClick={() => handleAttachmentDelete(att)}>
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
                <th>Status</th>
                <th>Titel</th>
                <th>Datum</th>
                <th>Uhrzeit</th>
                <th>Zielgruppe</th>
                <th>Notizen</th>
                <th>Archiv</th>
                <th>Dokumente</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((item) => (
                <tr key={item.id} className={item.archived ? 'archived-row' : ''}>
                  <td>
                    {(() => {
                      const color = getTrafficLightForTraining(item);
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
                  <td>{formatDate(item.dateFrom)}</td>
                  <td>
                    {item.timeFrom}
                    {item.timeTo ? ` - ${item.timeTo}` : ''}
                  </td>
                  <td>{item.targetGroup}</td>
                  <td>{item.notes}</td>
                  <td>{item.archived ? 'Ja' : 'Nein'}</td>
                  <td>
                    {(item.attachments || []).length === 0 && '–'}
                    {(item.attachments || []).length > 0 && (
                      <span>
                        {(item.attachments || []).map((att, index) => (
                          <span
                            key={att.id || index}
                            className="attachment-name"
                            onClick={() => handleAttachmentOpen(att)}
                            style={{ cursor: 'pointer', textDecoration: 'underline', display: 'inline-block' }}
                          >
                            {att.fileName || 'Dokument'}
                            {index < (item.attachments || []).length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
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

export default TrainingsView;
