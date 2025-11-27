// Wiederverwendbares 3-Punkte-Menü für Tabellenzeilen-Aktionen.
// Wird in allen Listen/Tabellen genutzt, um Bearbeiten/Archivieren/Löschen
// über ein einheitliches Menü anzubieten.
import React, { useEffect, useRef, useState } from 'react';

function RowActionsMenu({ onEdit, onArchive, onDelete, archived }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleDeleteClick() {
    // Zentrale Sicherheitsabfrage vor Hard Delete eines Dokuments.
    if (
      !window.confirm(
        'Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      )
    ) {
      return;
    }
    if (onDelete) onDelete();
  }

  return (
    <div className="row-actions-menu" ref={ref}>
      <button
        type="button"
        className="row-actions-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="row-actions-dropdown">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Bearbeiten
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
            >
              {archived ? 'Reaktivieren' : 'Archivieren'}
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={handleDeleteClick}>
              Löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default RowActionsMenu;
