import React, { useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  getTrafficLightForAbsence,
  getTrafficLightForRoadwork,
  getTrafficLightForCharterTrip,
  getTrafficLightForAppointment,
  getTrafficLightForTodo,
  getTrafficLightForTraining,
} from '../utils/trafficLight.js';
import { useAuth } from '../auth/AuthContext.jsx';

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(date, day) {
  if (!date) return false;
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function isWithinNextDays(date, today, days) {
  if (!date) return false;
  const diff = (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  return diff > 0 && diff <= days;
}

async function loadBriefingData() {
  const today = toDateOnly(new Date());
  const next7Date = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [absSnap, roadSnap, charterSnap, appSnap, todoSnap, trainSnap] = await Promise.all([
    getDocs(query(collection(db, 'absences'), where('archived', '==', false))),
    getDocs(query(collection(db, 'roadworks'), where('archived', '==', false))),
    getDocs(query(collection(db, 'charterTrips'), where('archived', '==', false))),
    getDocs(query(collection(db, 'appointments'), where('archived', '==', false))),
    getDocs(query(collection(db, 'todos'), where('archived', '==', false))),
    getDocs(query(collection(db, 'trainings'), where('archived', '==', false))),
  ]);

  const todayItems = [];
  const next7DaysItems = [];

  function addItem(base, dateForTodayCheck, dateForRangeCheck) {
    const dTodayCheck = toDateOnly(dateForTodayCheck);
    const dRangeCheck = toDateOnly(dateForRangeCheck);

    if (dTodayCheck && isSameDay(dTodayCheck, today)) {
      todayItems.push(base);
    } else if (dRangeCheck && isWithinNextDays(dRangeCheck, today, 7)) {
      next7DaysItems.push(base);
    }
  }

  absSnap.forEach((docSnap) => {
    const a = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForAbsence(a);
    const pn = a.personnelNumber ? ` PN ${a.personnelNumber}` : '';
    const item = {
      type: 'absence',
      id: a.id,
      title: `Abwesenheit${pn}`,
      from: a.startDate || null,
      to: a.endDate || a.startDate || null,
      returnDate: a.returnDate || null,
      personalNumber: a.personnelNumber || null,
      status: a.status || '',
      color,
    };
    addItem(item, a.startDate, a.endDate || a.startDate);
  });

  roadSnap.forEach((docSnap) => {
    const r = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForRoadwork(r);
    const item = {
      type: 'roadwork',
      id: r.id,
      title: r.title || 'Baustelle',
      from: r.startDate || null,
      to: r.endDate || r.startDate || null,
      status: r.status || '',
      lines: r.lines || [],
      color,
    };
    addItem(item, r.startDate, r.startDate);
  });

  charterSnap.forEach((docSnap) => {
    const c = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForCharterTrip(c);
    const item = {
      type: 'charterTrip',
      id: c.id,
      title: c.label || 'Fahrt',
      date: c.date || null,
      outboundTime: c.outboundTime || null,
      returnTime: c.returnTime || null,
      passengerCount: c.passengerCount ?? null,
      status: c.status || '',
      color,
    };
    addItem(item, c.date, c.date);
  });

  appSnap.forEach((docSnap) => {
    const a = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForAppointment(a);
    const item = {
      type: 'appointment',
      id: a.id,
      title: a.title || 'Termin',
      date: a.date || null,
      timeFrom: a.timeFrom || null,
      timeTo: a.timeTo || null,
      location: a.location || null,
      color,
    };
    addItem(item, a.date, a.date);
  });

  todoSnap.forEach((docSnap) => {
    const t = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForTodo(t);
    const item = {
      type: 'todo',
      id: t.id,
      title: t.title || 'To-Do',
      dueDate: t.dueDate || null,
      dueTime: t.dueTime || null,
      priority: t.priority || 'normal',
      done: !!t.done,
      color,
    };
    addItem(item, t.dueDate, t.dueDate);
  });

  trainSnap.forEach((docSnap) => {
    const tr = { id: docSnap.id, ...docSnap.data() };
    const color = getTrafficLightForTraining(tr);
    const item = {
      type: 'training',
      id: tr.id,
      title: tr.title || 'Schulung',
      from: tr.dateFrom || null,
      to: tr.dateTo || tr.dateFrom || null,
      targetGroup: tr.targetGroup || null,
      color,
    };
    addItem(item, tr.dateFrom, tr.dateFrom);
  });

  return { todayItems, next7DaysItems };
}

async function callBriefingApi(payload) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Kein OpenAI-API-Schlüssel konfiguriert (VITE_OPENAI_API_KEY).');
  }

  const systemPrompt =
    'Du bist ein Assistent für die Verkehrsleitung eines Busunternehmens.\n' +
    'Du erhältst strukturierte Daten (Abwesenheiten, Baustellen, Fahrten, Termine, To-Dos, Schulungen) und sollst daraus ein klar strukturiertes, tabellarisches Briefing erstellen.\n\n' +
    'Die Ausgabe hat IMMER folgende Abschnitte mit deutschen Überschriften:\n\n' +
    '### Heute – Kritische Punkte (rot)\n' +
    '### Heute – Wichtige Punkte (gelb)\n' +
    '### Heute – Normale Punkte (grün)\n' +
    '### Nächste 7 Tage – Kritische Punkte (rot)\n' +
    '### Nächste 7 Tage – Geplante Punkte (grün)\n\n' +
    'Jeder Abschnitt besteht aus EINER Tabelle mit folgenden Spalten:\n\n' +
    'Kategorie | Beschreibung | Zeitraum | Personalnummer | Details\n\n' +
    'Formatregeln:\n' +
    '- Datum IMMER: TT.MM.JJJJ (deutsches Format).\n' +
    '- Zeitraum IMMER: TT.MM.JJJJ oder TT.MM.JJJJ–TT.MM.JJJJ.\n' +
    '- Spalte "Personalnummer" MUSS IMMER gefüllt sein: Wenn im Datensatz eine Personalnummer vorhanden ist (Feld "personalNumber"), schreibe dort exakt "PN <Nummer>" (z. B. "PN 241"). Wenn keine Personalnummer vorhanden ist, schreibe ein einzelnes "-". Lasse diese Spalte NIEMALS leer.\n' +
    '- Insbesondere bei Abwesenheiten (type "absence") MUSS die vorhandene Personalnummer immer als "PN <Nummer>" in der Spalte "Personalnummer" stehen.\n' +
    '- KEINE Klarnamen.\n' +
    '- KEINE Absätze oder Fließtexte außerhalb der Tabellen.\n' +
    '- KEINE Erklärtexte, sondern klare Tabellen.\n\n' +
    'Sortiere die Einträge nach Datum → Ampel (rot/gelb/grün) → Kategorie.\n\n' +
    'Fasse dich in den Details kurz (max. 1 Satz).';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KI-Anfrage fehlgeschlagen: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function KiAssistantView() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatResult, setChatResult] = useState('');

  async function handleGenerateBriefing() {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const payload = await loadBriefingData();
      const text = await callBriefingApi(payload);
      setResult(text.trim());
    } catch (e) {
      setError(e.message || 'Unbekannter Fehler beim Erzeugen des Briefings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAskQuestion() {
    if (!question.trim()) {
      return;
    }
    setChatLoading(true);
    setChatError('');
    setChatResult('');
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('Kein OpenAI-API-Schlüssel konfiguriert (VITE_OPENAI_API_KEY).');
      }

      const payload = await loadBriefingData();
      const chatSystemPrompt =
        'Du bist ein Assistent für die Verkehrsleitung eines Busunternehmens. ' +
        'Du beantwortest eine freie Frage auf Basis der übergebenen kompakten Daten (heute und nächste 7 Tage). ' +
        'Du darfst NUR lesen, bewerten und erklären, aber KEINE Schreib- oder Änderungsaktionen an Diensten oder Daten ausführen. ' +
        'Erkläre kurz und sachlich auf Deutsch, ohne Klarnamen zu verwenden.';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: chatSystemPrompt },
            {
              role: 'user',
              content: JSON.stringify({
                question: question.trim(),
                data: payload,
              }),
            },
          ],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`KI-Anfrage fehlgeschlagen: ${response.status} ${text}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || '';
      setChatResult(answer.trim());
    } catch (e) {
      setChatError(e.message || 'Unbekannter Fehler beim Stellen der KI-Frage.');
    } finally {
      setChatLoading(false);
    }
  }

  if (role !== 'admin') {
    return (
      <div className="section-root">
        <h2>KI-Assistent</h2>
        <p>Dieser Bereich steht aktuell nur Administratoren zur Verfügung.</p>
      </div>
    );
  }

  return (
    <div className="section-root ki-assistant-root">
      <h2>KI-Assistent</h2>
      <p>
        Hier kannst du ein KI-Briefing für heute und die nächsten 7 Tage erzeugen. Die KI liest nur die
        vorhandenen Daten, fasst sie zusammen und macht Vorschläge zur Reihenfolge der Bearbeitung – es
        werden keine automatischen Änderungen an Diensten oder Daten vorgenommen.
      </p>

      <div style={{ marginBottom: '12px' }}>
        <button type="button" onClick={handleGenerateBriefing} disabled={loading}>
          Tagesbriefing erzeugen (heute + nächste 7 Tage)
        </button>
      </div>

      {loading && <p>KI-Briefing wird erzeugt...</p>}
      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="ki-briefing-output">
          <h3>Erzeugtes Briefing</h3>
          <div className="ki-briefing-text">
            {result.split('\n').map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <hr style={{ margin: '24px 0' }} />

      <div className="ki-chat-section">
        <h3>KI-Frage stellen</h3>
        <p>
          Stelle hier eine beliebige Frage zur aktuellen Datenlage. Die KI liest nur die vorhandenen Daten,
          bewertet oder erklärt sie und nimmt keine Änderungen an Firestore vor.
        </p>
        <div style={{ marginBottom: '8px' }}>
          <textarea
            rows={4}
            style={{ width: '100%' }}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Deine Frage an die KI..."
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <button type="button" onClick={handleAskQuestion} disabled={chatLoading}>
            KI-Frage stellen
          </button>
        </div>
        {chatLoading && <p>KI-Antwort wird erzeugt...</p>}
        {chatError && <p className="error-text">{chatError}</p>}
        {chatResult && (
          <div className="ki-chat-output">
            <h3>Antwort der KI</h3>
            <div className="ki-briefing-text">
              {chatResult.split('\n').map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KiAssistantView;
