// Gemeinsamer Hook, um Sortierzustand (Feld + Richtung) pro Tabelle
// in localStorage zu merken. Die aufrufende View übergibt einen eindeutigen Key.
import { useEffect, useState } from 'react';

export function usePersistentSort(storageKey, defaultField, defaultDirection = 'asc') {
  const [sortBy, setSortBy] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState(defaultDirection);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.sortBy) setSortBy(parsed.sortBy);
      if (parsed?.sortDirection) setSortDirection(parsed.sortDirection);
    } catch {
      // localStorage evtl. nicht verfügbar (Privatmodus o.ä.) –
      // Sortierung funktioniert dann einfach mit den Default-Werten.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ sortBy, sortDirection }),
      );
    } catch {
      // Fehler beim Speichern sind hier nicht kritisch.
    }
  }, [storageKey, sortBy, sortDirection]);

  function updateSort(field) {
    setSortBy((prevField) => {
      if (prevField === field) {
        setSortDirection((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('asc');
      return field;
    });
  }

  return { sortBy, sortDirection, setSortBy, setSortDirection, updateSort };
}
