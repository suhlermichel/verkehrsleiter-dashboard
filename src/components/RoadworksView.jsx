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
import { getTrafficLightForRoadwork, trafficLightClass } from '../utils/trafficLight.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { validateFile, createAttachmentMetadata } from '../utils/attachments.js';
import { deleteDocument } from '../utils/deleteDocument.js'; // Version 1.7: zentrale Löschfunktion für Baustellen
import { usePersistentSort } from '../hooks/usePersistentSort.js'; // Version 1.7: Sortierzustand pro Tab merken
import RowActionsMenu from './RowActionsMenu.jsx'; // Version 1.7: 3-Punkte-Menü für Zeilenaktionen

const ROADWORK_STATUS = ['angekündigt', 'läuft', 'endet bald', 'beendet'];

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
    lines: '',
    startDate: '',
    endDate: '',
    status: 'angekündigt',
    notes: '',
    measures: {
      ersatzhaltestelle: false,
      fahrerinfo: false,
      fahrgastinfo: false,
      socialMedia: false,
      servicebuero: false,
      infoanzeiger: false,
      itcsUmleitung: false,
    },
    archived: false,
  };
}

function RoadworksView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [filterArchived, setFilterArchived] = useState('active');
  const [filterStatus, setFilterStatus] = useState('all');
  // Version 1.7: Sortierzustand pro Reiter (Baustellen) in localStorage merken
  const { sortBy, sortDirection, setSortBy, setSortDirection } = usePersistentSort(
    'sort_roadworks',
    'startDate',
    'asc',
  );
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const colRef = collection(db, 'roadworks');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Baustellen: ' + err.message);
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

    if (filterStatus !== 'all') {
      list = list.filter((i) => i.status === filterStatus);
    }

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '') * dir;
      }
      const da = a[sortBy] || '';
      const dbv = b[sortBy] || '';
      return da.localeCompare(dbv) * dir;
    });

    return list;
  }, [items, filterArchived, filterStatus, sortBy, sortDirection]);

  function handlePrint() {
    alert('Druck wird vorbereitet. Bitte wählen Sie im nächsten Schritt Ihren Drucker aus.');
    window.print();
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleMeasureToggle(key) {
    setForm((prev) => ({
      ...prev,
      measures: {
        ...prev.measures,
        [key]: !prev.measures?.[key],
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.title || !form.startDate || !form.endDate) {
      setError('Bitte mindestens Titel, Von-Datum und Bis-Datum ausfüllen.');
      return;
    }

    try {
      const payload = {
        title: form.title,
        location: form.location || '',
        lines: form.lines
          ? form.lines
              .split(',')
              .map((l) => l.trim())
              .filter(Boolean)
          : [],
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        notes: form.notes || '',
        measures: form.measures || {
          ersatzhaltestelle: false,
          fahrerinfo: false,
          fahrgastinfo: false,
          socialMedia: false,
          servicebuero: false,
          infoanzeiger: false,
          itcsUmleitung: false,
        },
        archived: form.archived || false,
        updatedAt: serverTimestamp(),
      };

      if (form.id) {
        const ref = doc(db, 'roadworks', form.id);
        await updateDoc(ref, payload);
      } else {
        await addDoc(collection(db, 'roadworks'), payload);
      }

      setForm(emptyForm());
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
    }
  }

  const activeRoadwork = useMemo(
    () => items.find((i) => i.id === form.id),
    [items, form.id],
  );

  const activeAttachments = activeRoadwork?.attachments || [];

  async function handleAttachmentUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError('');
    if (!form.id) {
      setUploadError('Bitte speichern Sie die Baustelle zuerst, bevor Sie Dokumente hochladen.');
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
      const storagePath = `roadworks/${form.id}/attachments/${attachmentId}-${file.name}`;
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
      const refDoc = doc(db, 'roadworks', form.id);
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
      const refDoc = doc(db, 'roadworks', form.id);
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

  function handleEdit(item) {
    setForm({
      id: item.id,
      title: item.title || '',
      location: item.location || '',
      lines: (item.lines || []).join(', '),
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      status: item.status || 'angekündigt',
      notes: item.notes || '',
      measures: {
        ersatzhaltestelle: !!item.measures?.ersatzhaltestelle,
        fahrerinfo: !!item.measures?.fahrerinfo,
        fahrgastinfo: !!item.measures?.fahrgastinfo,
        socialMedia: !!item.measures?.socialMedia,
        servicebuero: !!item.measures?.servicebuero,
        infoanzeiger: !!item.measures?.infoanzeiger,
        itcsUmleitung: !!item.measures?.itcsUmleitung,
      },
      archived: !!item.archived,
    });
    setShowForm(true);
  }

  async function toggleArchive(item) {
    try {
      const ref = doc(db, 'roadworks', item.id);
      await updateDoc(ref, { archived: !item.archived, updatedAt: serverTimestamp() });
    } catch (err) {
      setError('Fehler beim Aktualisieren des Archiv-Status: ' + err.message);
    }
  }

  // Version 1.7: Hard Delete über zentrale deleteDocument-Hilfsfunktion.
  // Hinweis: Für Baustellen ist eine dokumentierte Archivierung häufig sinnvoller
  // als ein Hard Delete. Die Löschfunktion bleibt dennoch verfügbar.
  async function handleDelete(item) {
    try {
      await deleteDocument('roadworks', item.id);
    } catch (err) {
      setError('Fehler beim Löschen: ' + err.message);
    }
  }

  return (
    <div className="section-root">
      <h2>Baustellen / Sperrungen</h2>

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
          <label>
            Status:
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Alle</option>
              {ROADWORK_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-group">
          <label>
            Sortieren nach:
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="startDate">Beginn</option>
              <option value="endDate">Ende</option>
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

      {loading && <p>Lade Baustellen...</p>}
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
                  <th>Ampel</th>
                  <th>Titel</th>
                  <th>Ort / Lage</th>
                  <th>Betroffene Linien</th>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Status</th>
                  <th>Maßnahmen</th>
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
                        const color = getTrafficLightForRoadwork(item);
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
                    <td>{(item.lines || []).join(', ')}</td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{formatDate(item.endDate)}</td>
                    <td>{item.status}</td>
                    <td>
                      {(() => {
                        const labels = [];
                        const m = item.measures || {};
                        if (m.ersatzhaltestelle) labels.push('Ersatzhaltestelle');
                        if (m.fahrerinfo) labels.push('Fahrerinfo');
                        if (m.fahrgastinfo) labels.push('Fahrgastinfo');
                        if (m.socialMedia) labels.push('Social Media');
                        if (m.servicebuero) labels.push('Servicebüro');
                        if (m.infoanzeiger) labels.push('Infoanzeiger');
                        if (m.itcsUmleitung) labels.push('ITCS-Umleitung');
                        return labels.join(', ');
                      })()}
                    </td>
                    <td className="notes-cell">{item.notes}</td>
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
                    <td colSpan={11}>Keine Einträge gefunden.</td>
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
                Ort / Beschreibung der Lage
                <input
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={handleChange}
                />
              </label>
              <label>
                Betroffene Linien (Komma-getrennt, z. B. 1008, 1020)
                <input
                  name="lines"
                  type="text"
                  value={form.lines}
                  onChange={handleChange}
                />
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
                Status
                <select name="status" value={form.status} onChange={handleChange}>
                  {ROADWORK_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                    Bitte speichern Sie die Baustelle zuerst, bevor Sie Anhänge hochladen.
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

              <fieldset className="checkbox-group">
                <legend>Maßnahmen</legend>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.ersatzhaltestelle}
                    onChange={() => handleMeasureToggle('ersatzhaltestelle')}
                  />
                  Ersatzhaltestelle
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.fahrerinfo}
                    onChange={() => handleMeasureToggle('fahrerinfo')}
                  />
                  Fahrerinfo
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.fahrgastinfo}
                    onChange={() => handleMeasureToggle('fahrgastinfo')}
                  />
                  Fahrgastinfo
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.socialMedia}
                    onChange={() => handleMeasureToggle('socialMedia')}
                  />
                  Social Media
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.servicebuero}
                    onChange={() => handleMeasureToggle('servicebuero')}
                  />
                  Servicebüro
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.infoanzeiger}
                    onChange={() => handleMeasureToggle('infoanzeiger')}
                  />
                  Infoanzeiger
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.measures?.itcsUmleitung}
                    onChange={() => handleMeasureToggle('itcsUmleitung')}
                  />
                  ITCS Umleitung
                </label>
              </fieldset>

              <div className="form-buttons">
                <button type="submit">
                  {form.id ? 'Speichern' : 'Anlegen'}
                </button>
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
                <th>Ampel</th>
                <th>Titel</th>
                <th>Ort / Lage</th>
                <th>Betroffene Linien</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Status</th>
                <th>Maßnahmen</th>
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
                      const color = getTrafficLightForRoadwork(item);
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
                  <td>{(item.lines || []).join(', ')}</td>
                  <td>{formatDate(item.startDate)}</td>
                  <td>{formatDate(item.endDate)}</td>
                  <td>{item.status}</td>
                  <td>
                    {(() => {
                      const labels = [];
                      const m = item.measures || {};
                      if (m.ersatzhaltestelle) labels.push('Ersatzhaltestelle');
                      if (m.fahrerinfo) labels.push('Fahrerinfo');
                      if (m.fahrgastinfo) labels.push('Fahrgastinfo');
                      if (m.socialMedia) labels.push('Social Media');
                      if (m.servicebuero) labels.push('Servicebüro');
                      if (m.infoanzeiger) labels.push('Infoanzeiger');
                      if (m.itcsUmleitung) labels.push('ITCS-Umleitung');
                      return labels.join(', ');
                    })()}
                  </td>
                  <td className="notes-cell">{item.notes}</td>
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
                  <td colSpan={11}>Keine Einträge gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default RoadworksView;
