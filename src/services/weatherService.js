// Einfacher Wetter-Service für Suhl über Open-Meteo (kostenlose API)

const SUHL_COORDS = {
  latitude: 50.609,
  longitude: 10.694,
};

function mapWeatherCodeToDescription(code) {
  // Siehe Open-Meteo Wettercodes – hier nur grob gruppiert für das Dashboard
  if (code === 0) return { text: 'Klar', icon: 'clear' };
  if (code === 1 || code === 2) return { text: 'Leicht bewölkt', icon: 'cloud' };
  if (code === 3) return { text: 'Bedeckt', icon: 'cloud' };
  if (code >= 45 && code <= 48) return { text: 'Nebel', icon: 'fog' };
  if (code >= 51 && code <= 67) return { text: 'Niesel / Regen', icon: 'rain' };
  if (code >= 71 && code <= 77) return { text: 'Schnee', icon: 'snow' };
  if (code >= 80 && code <= 82) return { text: 'Regen', icon: 'rain' };
  if (code >= 85 && code <= 86) return { text: 'Starker Schneefall', icon: 'snow' };
  if (code >= 95) return { text: 'Gewitter', icon: 'storm' };
  return { text: 'Unbekannt', icon: 'cloud' };
}

export async function fetchWeatherForSuhl() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(SUHL_COORDS.latitude));
  url.searchParams.set('longitude', String(SUHL_COORDS.longitude));
  url.searchParams.set('current_weather', 'true');
  url.searchParams.set('timezone', 'Europe/Berlin');
  // Für Tagesverlauf & 5-Tage-Vorhersage stündliche und tägliche Daten laden
  url.searchParams.set('hourly', 'temperature_2m,weathercode');
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min');

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Wetterabfrage fehlgeschlagen: ${response.status} ${text}`);
  }

  const data = await response.json();
  const current = data.current_weather || {};
  const code = typeof current.weathercode === 'number' ? current.weathercode : null;
  const { text, icon } = mapWeatherCodeToDescription(code ?? -1);

  const temperature = typeof current.temperature === 'number' ? current.temperature : null;
  const windSpeed = typeof current.windspeed === 'number' ? current.windspeed : null;

  let hazardText = '';
  if (code != null) {
    // sehr einfache Heuristiken für Gefahrenhinweise
    if (code >= 80 && code <= 82 && temperature != null && temperature > 0) {
      hazardText = 'Achtung Aquaplaning – nasse Fahrbahnen.';
    } else if ((code >= 71 && code <= 77) || (temperature != null && temperature <= 0)) {
      hazardText = 'Glättegefahr / Schneefall – vorsichtig fahren.';
    } else if (code >= 95) {
      hazardText = 'Gewitter / Sturm – mit Böen rechnen.';
    }
  }

  if (!hazardText && temperature != null && temperature >= 30) {
    hazardText = 'Hitze – Belastung für Fahrpersonal beachten.';
  }

  if (!hazardText && windSpeed != null && windSpeed >= 50) {
    hazardText = 'Starker Wind – Seitenwindempfindliche Strecken beachten.';
  }

  // --- Einfacher Tagesverlauf (Morgen/Mittag/Abend) ---
  const hourly = data.hourly || {};
  const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
  const hourlyTemps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const hourlyCodes = Array.isArray(hourly.weathercode) ? hourly.weathercode : [];

  function findSlot(label, targetHourLocal) {
    if (!hourlyTimes.length) return null;
    // times sind im ISO-Format in Europe/Berlin
    const now = new Date();
    let futureIdx = -1;
    let firstIdxForHour = -1;

    for (let i = 0; i < hourlyTimes.length; i += 1) {
      const t = new Date(hourlyTimes[i]);
      const h = t.getHours();
      if (h !== targetHourLocal) continue;

      if (firstIdxForHour === -1) {
        firstIdxForHour = i;
      }

      if (t >= now) {
        futureIdx = i;
        break;
      }
    }

    const bestIdx = futureIdx !== -1 ? futureIdx : firstIdxForHour;
    if (bestIdx === -1) return null;

    const temp = typeof hourlyTemps[bestIdx] === 'number' ? hourlyTemps[bestIdx] : null;
    const codeSlot = typeof hourlyCodes[bestIdx] === 'number' ? hourlyCodes[bestIdx] : null;
    const mapped = mapWeatherCodeToDescription(codeSlot ?? -1);
    return {
      label,
      time: hourlyTimes[bestIdx] || null,
      temperatureC: temp,
      icon: mapped.icon,
      conditionText: mapped.text,
    };
  }

  const todayTimeline = [
    findSlot('08 Uhr', 8),
    findSlot('14 Uhr', 14),
    findSlot('20 Uhr', 20),
  ].filter(Boolean);

  // --- 5-Tage-Vorhersage ---
  const daily = data.daily || {};
  const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
  const dailyMax = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const dailyMin = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const dailyCodes = Array.isArray(daily.weathercode) ? daily.weathercode : [];

  const dailyForecast = [];
  for (let i = 0; i < Math.min(dailyTimes.length, 5); i += 1) {
    const dStr = dailyTimes[i];
    const dDate = dStr ? new Date(dStr) : null;
    const weekday = dDate
      ? dDate.toLocaleDateString('de-DE', {
          weekday: 'short',
        })
      : '';
    const max = typeof dailyMax[i] === 'number' ? dailyMax[i] : null;
    const min = typeof dailyMin[i] === 'number' ? dailyMin[i] : null;
    const dCode = typeof dailyCodes[i] === 'number' ? dailyCodes[i] : null;
    const mapped = mapWeatherCodeToDescription(dCode ?? -1);

    dailyForecast.push({
      date: dStr,
      weekday,
      maxTemperatureC: max,
      minTemperatureC: min,
      icon: mapped.icon,
      conditionText: mapped.text,
    });
  }

  return {
    temperatureC: temperature,
    windSpeedKmh: windSpeed,
    conditionText: text,
    icon,
    time: current.time || null,
    hazardText,
    todayTimeline,
    dailyForecast,
  };
}
