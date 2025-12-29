import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { fetchWeatherForSuhl } from '../services/weatherService.js';

function formatTime(date) {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatKw(date) {
  // Einfache KW-Berechnung nach ISO 8601
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `KW ${weekNo}`;
}

function getRoadworkSeverity(roadwork) {
  const title = String(roadwork.title || '').toLowerCase();
  const status = String(roadwork.status || '').toLowerCase();

  if (title.includes('sperrung')) return 'sperrung';
  if (title.includes('umleitung')) return 'umleitung';
  if (title.includes('baustelle')) return 'baustelle';

  if (status === 'laufend') return 'baustelle';
  if (status === 'angekündigt') return 'umleitung';

  return 'info';
}

function FahrdienstDashboardView() {
  const [roadworks, setRoadworks] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState('');
  const [roadworksSort, setRoadworksSort] = useState({ sortBy: 'startDate', sortDirection: 'asc' });

  // Uhrzeit/Datum
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Sortier-Einstellungen aus der Baustellenverwaltung (RoadworksView) übernehmen
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('sort_roadworks');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setRoadworksSort({
        sortBy: parsed?.sortBy || 'startDate',
        sortDirection: parsed?.sortDirection || 'asc',
      });
    } catch {
      // Wenn localStorage nicht verfügbar ist, bleiben die Default-Werte bestehen.
    }
  }, []);

  // Daten-Streams
  useEffect(() => {
    const unsubRoadworks = onSnapshot(collection(db, 'roadworks'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRoadworks(data.filter((i) => !i.archived));
    });

    const unsubTrainings = onSnapshot(collection(db, 'trainings'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTrainings(data.filter((i) => !i.archived));
    });

    const unsubMessages = onSnapshot(collection(db, 'serviceMessages'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(data.filter((i) => !i.archived));
    });

    return () => {
      unsubRoadworks();
      unsubTrainings();
      unsubMessages();
    };
  }, []);

  // Wetter laden + alle 15 Minuten aktualisieren
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setWeatherError('');
        const w = await fetchWeatherForSuhl();
        if (!cancelled) setWeather(w);
      } catch (e) {
        if (!cancelled) setWeatherError(e.message || 'Fehler beim Laden der Wetterdaten.');
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const disturbances = useMemo(
    () => messages.filter((m) => m.type === 'disturbance'),
    [messages],
  );
  const infoMessages = useMemo(
    () => messages.filter((m) => m.type === 'info' || m.type === 'plan'),
    [messages],
  );

  const quoteMessage = useMemo(
    () => messages.find((m) => m.type === 'quote') || null,
    [messages],
  );

  const upcomingTrainings = useMemo(() => {
    const today = new Date();
    const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    return trainings
      .filter((t) => {
        if (!t.dateFrom) return false;
        const d = new Date(t.dateFrom);
        return d >= today && d <= in60Days;
      })
      .sort((a, b) => String(a.dateFrom || '').localeCompare(String(b.dateFrom || '')));
  }, [trainings]);

  const activeRoadworks = useMemo(() => {
    const { sortBy, sortDirection } = roadworksSort;
    const list = roadworks.slice();

    list.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'status') {
        return (String(a.status || '').localeCompare(String(b.status || ''))) * dir;
      }
      const da = String(a[sortBy] || '');
      const db = String(b[sortBy] || '');
      return da.localeCompare(db) * dir;
    });

    return list;
  }, [roadworks, roadworksSort]);

  const headerTime = formatTime(now);
  const headerDate = formatDate(now);
  const headerKw = formatKw(now);

  const weatherUpdatedTime = weather?.time ? formatTime(new Date(weather.time)) : null;

  const tickerParts = useMemo(() => {
    if (!messages.length) return [];
    return messages
      .filter((m) => m.showInTicker)
      .map((m) => {
        let part = m.title || '';
        if (m.description) part += ' – ' + m.description;
        return part;
      });
  }, [messages]);

  let alertBaseText = 'Keine aktuellen Hinweise.';
  if (tickerParts.length > 0) {
    // Zwischen den Meldungen bewusst viele Leerzeichen und die Trennzeichen +++ anzeigen.
    // Normale Leerzeichen werden im HTML zusammengefasst, daher nutzen wir geschützte Leerzeichen (\u00A0).
    const spacer = '\u00A0\u00A0\u00A0\u00A0\u00A0+++\u00A0\u00A0\u00A0\u00A0\u00A0';
    alertBaseText = tickerParts.join(spacer);
  }
  // Auch zwischen den Wiederholungen denselben Abstand verwenden
  const repeatSpacer = '\u00A0\u00A0\u00A0\u00A0\u00A0+++\u00A0\u00A0\u00A0\u00A0\u00A0';
  const singleTickerChunk = `${alertBaseText}${repeatSpacer}`;
  const tickerText = singleTickerChunk;

  return (
    <div className="fahrdienst-root">
      <header className="fahrdienst-header">
        <div className="fahrdienst-header-left">
          <h1>SNG Fahrdienst-Dashboard</h1>
        </div>
        <div className="fahrdienst-header-right">
          <div className="fahrdienst-header-datetime">
            <span className="fahrdienst-datetime-kw">{headerKw}</span>
            <span className="fahrdienst-datetime-date">{headerDate}</span>
            <span className="fahrdienst-datetime-time">{headerTime}</span>
          </div>
        </div>
      </header>

      <div className="fahrdienst-alert-bar">
        <div className="fahrdienst-alert-inner">
          <div className="fahrdienst-alert-track">
            <span className="fahrdienst-alert-text">{tickerText}</span>
            <span className="fahrdienst-alert-text">{tickerText}</span>
          </div>
        </div>
      </div>

      <main className="fahrdienst-main">
        <section>
          <div className="fahrdienst-panel fahrdienst-panel-weather">
              <h2>
                🌦️ Wetter für Suhl
                {weatherUpdatedTime && (
                  <span className="fahrdienst-weather-updated">aktualisiert um {weatherUpdatedTime}</span>
                )}
              </h2>
              {weatherError && <p className="error-text">{weatherError}</p>}
              {weather && !weatherError && (
                <div className="fahrdienst-weather-main">
                  <div className="fahrdienst-weather-main-top">
                    <div className="fahrdienst-weather-icons">
                      {weather.icon === 'clear' && <span>☀️</span>}
                      {weather.icon === 'cloud' && <span>☁️</span>}
                      {weather.icon === 'rain' && <span>🌧️</span>}
                      {weather.icon === 'snow' && <span>❄️</span>}
                      {weather.icon === 'fog' && <span>🌫️</span>}
                      {weather.icon === 'storm' && <span>⛈️</span>}
                    </div>
                    <div className="fahrdienst-weather-temp">
                      {weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : '–'}
                    </div>
                  </div>
                  <div className="fahrdienst-weather-desc">
                    <div>{weather.conditionText}</div>
                    {weather.hazardText && (
                      <div className="fahrdienst-weather-warning">Warnungen: {weather.hazardText}</div>
                    )}
                  </div>
                </div>
              )}
              {!weather && !weatherError && <p>Wetterdaten werden geladen...</p>}
              {weather && weather.todayTimeline && weather.todayTimeline.length > 0 && (
                <div className="fahrdienst-weather-today">
                  {weather.todayTimeline.map((slot) => (
                    <div key={slot.label} className="fahrdienst-weather-today-slot">
                      <div className="fahrdienst-weather-today-label">{slot.label}</div>
                      <div className="fahrdienst-weather-today-temp">
                        {slot.temperatureC != null ? `${Math.round(slot.temperatureC)}°C` : '–'}
                      </div>
                      <div className="fahrdienst-weather-today-icon">
                        {slot.icon === 'clear' && <span>☀️</span>}
                        {slot.icon === 'cloud' && <span>☁️</span>}
                        {slot.icon === 'rain' && <span>🌧️</span>}
                        {slot.icon === 'snow' && <span>❄️</span>}
                        {slot.icon === 'fog' && <span>🌫️</span>}
                        {slot.icon === 'storm' && <span>⛈️</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {weather && weather.dailyForecast && weather.dailyForecast.length > 0 && (
                <div className="fahrdienst-weather-forecast">
                  {weather.dailyForecast.map((d) => (
                    <div key={d.date} className="fahrdienst-weather-forecast-day">
                      <div className="fahrdienst-weather-forecast-weekday">{d.weekday}</div>
                      <div className="fahrdienst-weather-forecast-icon">
                        {d.icon === 'clear' && <span>☀️</span>}
                        {d.icon === 'cloud' && <span>☁️</span>}
                        {d.icon === 'rain' && <span>🌧️</span>}
                        {d.icon === 'snow' && <span>❄️</span>}
                        {d.icon === 'fog' && <span>🌫️</span>}
                        {d.icon === 'storm' && <span>⛈️</span>}
                      </div>
                      <div className="fahrdienst-weather-forecast-temp">
                        {d.minTemperatureC != null && d.maxTemperatureC != null
                          ? `${Math.round(d.minTemperatureC)} / ${Math.round(d.maxTemperatureC)}°C`
                          : '–'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        <section>
          <div className="fahrdienst-panel fahrdienst-panel-traffic">
            <h2>🚧 Verkehrsinformationen</h2>
            <ul className="fahrdienst-list">
              {activeRoadworks.map((r) => (
                <li key={r.id} className="fahrdienst-list-item">
                  <div
                    className={`fahrdienst-traffic-dot fahrdienst-traffic-dot-${getRoadworkSeverity(
                      r,
                    )}`}
                  />
                  <div className="fahrdienst-list-text">
                    <div className="fahrdienst-list-title">
                      {r.title || 'Baustelle / Maßnahme'}
                      {r.isNew ? <span className="fahrdienst-badge-new">NEU</span> : null}
                      {r.endingSoon ? (
                        <span className="fahrdienst-badge-endingSoon">bald endend</span>
                      ) : null}
                    </div>
                    <div className="fahrdienst-list-sub">
                      {r.location || ''}
                      {r.lines ? ` – Linien: ${r.lines}` : ''}
                      {r.startDate
                        ? ` – von ${formatDate(new Date(r.startDate))}`
                        : ''}
                      {r.endDate
                        ? ` bis ${formatDate(new Date(r.endDate))}`
                        : ''}
                      {r.notes ? ` – ${r.notes}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {activeRoadworks.length === 0 && <li>Aktuell keine Verkehrshindernisse erfasst.</li>}
            </ul>
          </div>
        </section>

        <section>
          <div className="fahrdienst-panel fahrdienst-panel-disturbances">
              <h2>🚨 Aktuelle Informationen</h2>
              <ul className="fahrdienst-list">
                {disturbances.map((m) => (
                  <li key={m.id} className="fahrdienst-list-item">
                    <div
                      className={
                        m.priority === 'high'
                          ? 'fahrdienst-stoerung-dot fahrdienst-stoerung-dot-high'
                          : 'fahrdienst-stoerung-dot fahrdienst-stoerung-dot-normal'
                      }
                    />
                    <div className="fahrdienst-list-text">
                      <div className="fahrdienst-list-title">
                        {m.title}
                        {m.isNew ? <span className="fahrdienst-badge-new">NEU</span> : null}
                      </div>
                      {m.description && <div className="fahrdienst-list-sub">{m.description}</div>}
                    </div>
                  </li>
                ))}
                {disturbances.length === 0 && <li>Keine aktuellen Störungen gemeldet.</li>}
              </ul>
            </div>
          </section>

        <section>
          <div className="fahrdienst-panel fahrdienst-panel-info">
              <h2>📝 Organisatorische Informationen</h2>
              <ul className="fahrdienst-list">
                {infoMessages.map((m) => (
                  <li key={m.id} className="fahrdienst-list-item">
                    <div className="fahrdienst-list-bullet">–</div>
                    <div className="fahrdienst-list-text">
                      <div className="fahrdienst-list-title">
                        {m.title}
                        {m.isNew ? <span className="fahrdienst-badge-new">NEU</span> : null}
                      </div>
                      {m.description && <div className="fahrdienst-list-sub">{m.description}</div>}
                    </div>
                  </li>
                ))}
                {infoMessages.length === 0 && <li>Keine organisatorischen Hinweise hinterlegt.</li>}
              </ul>
            </div>
          </section>

        <section>
          <div className="fahrdienst-panel fahrdienst-panel-trainings">
            <h2>📚 Anstehende Schulungen</h2>
            <ul className="fahrdienst-list">
              {upcomingTrainings.map((t) => (
                <li key={t.id} className="fahrdienst-list-item">
                  <div className="fahrdienst-list-bullet">•</div>
                  <div className="fahrdienst-list-text">
                    <div className="fahrdienst-list-title">
                      {t.title || 'Schulung'}
                      {t.isNew ? <span className="fahrdienst-badge-new">NEU</span> : null}
                    </div>
                    <div className="fahrdienst-list-sub">
                      {t.dateFrom ? formatDate(new Date(t.dateFrom)) : ''}
                      {t.dateTo ? ` – ${formatDate(new Date(t.dateTo))}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {upcomingTrainings.length === 0 && (
                <li>Keine anstehenden Schulungen im ausgewählten Zeitraum.</li>
              )}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default FahrdienstDashboardView;