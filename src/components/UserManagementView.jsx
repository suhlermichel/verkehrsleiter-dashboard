import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ROLES = [
  'admin',
  'verkehrsleiter',
  'vertretung_verkehrsleiter',
  'ueberwachung',
  'personalabteilung',
  'benutzer',
  'readonly',
];

const EMPTY_PERMISSIONS = {
  absences: { view: true, edit: false },
  roadworks: { view: true, edit: false },
  charter: { view: true, edit: false },
  appointments: { view: true, edit: false },
  medicalAppointments: { view: true, edit: false },
  notices: { view: true, edit: false },
  todos: { view: true, edit: false },
  trainings: { view: true, edit: false },
};

function labelForArea(area) {
  switch (area) {
    case 'absences':
      return 'Abwesenheiten';
    case 'roadworks':
      return 'Baustellen';
    case 'charter':
      return 'Gelegenheitsfahrten';
    case 'appointments':
      return 'Wichtige Termine';
    case 'medicalAppointments':
      return 'Termine Betriebsarzt';
    case 'notices':
      return 'Dienstanweisungen & Aushänge';
    case 'todos':
      return 'To-Dos';
    case 'trainings':
      return 'Schulungen';
    default:
      return area;
  }
}

function generateRandomPassword() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function UserManagementView() {
  const { role } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'verkehrsleiter',
  });

  const isAdmin = role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        setError('Fehler beim Laden der Benutzer: ' + err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setError('');

    if (!form.email) {
      setError('Bitte mindestens eine E-Mail-Adresse angeben.');
      return;
    }

    if (users.length >= 6) {
      setError('Es sind bereits 6 Benutzer angelegt. Mehr sind nicht erlaubt.');
      return;
    }

    try {
      const passwordToUse = form.password || generateRandomPassword();
      const cred = await createUserWithEmailAndPassword(auth, form.email, passwordToUse);
      const uid = cred.user.uid;
      const userRef = doc(collection(db, 'users'));
      await setDoc(userRef, {
        uid,
        email: form.email,
        displayName: form.displayName || '',
        role: form.role,
        permissions: EMPTY_PERMISSIONS,
      });
      // Benutzer erhält eine E-Mail, um ein eigenes Passwort zu setzen
      await sendPasswordResetEmail(auth, form.email).catch(() => {});
      setForm({ email: '', displayName: '', password: '', role: 'verkehrsleiter' });
    } catch (err) {
      setError('Fehler beim Anlegen des Benutzers: ' + err.message);
    }
  }

  async function handleDeleteUser(user) {
    setError('');
    const ok = window.confirm(
      `Benutzer "${user.email}" wirklich löschen? (Das Firebase-Konto selbst bleibt bestehen.)`,
    );
    if (!ok) return;
    try {
      const ref = doc(db, 'users', user.id);
      await deleteDoc(ref);
    } catch (err) {
      setError('Fehler beim Löschen des Benutzers: ' + err.message);
    }
  }

  async function togglePermission(user, area, kind) {
    try {
      const current = user.permissions || {};
      const areaPerm = current[area] || { view: true, edit: false };
      const updated = {
        ...current,
        [area]: { ...areaPerm, [kind]: !areaPerm[kind] },
      };
      const ref = doc(db, 'users', user.id);
      await updateDoc(ref, { permissions: updated });
    } catch (err) {
      setError('Fehler beim Aktualisieren der Rechte: ' + err.message);
    }
  }

  async function changeRole(user, newRole) {
    try {
      const ref = doc(db, 'users', user.id);
      await updateDoc(ref, { role: newRole });
    } catch (err) {
      setError('Fehler beim Aktualisieren der Rolle: ' + err.message);
    }
  }

  if (!isAdmin) {
    return (
      <div className="section-root">
        <h2>Benutzerverwaltung</h2>
        <p>Sie haben keine Berechtigung, die Benutzerverwaltung zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="section-root">
      <h2>Benutzerverwaltung</h2>
      <p>Maximal 6 Benutzer. Rollen und Rechte können hier gepflegt werden.</p>
      <p>
        Beim Anlegen wird an die angegebene E-Mail-Adresse automatisch eine Mail von Firebase
        gesendet. Darüber kann der Benutzer sein eigenes Passwort setzen oder zurücksetzen und
        sich anschließend über die normale Anmeldemaske im Dashboard anmelden.
      </p>

      <section className="form-section" style={{ maxWidth: 500 }}>
        <h3>Neuen Benutzer anlegen</h3>
        <form onSubmit={handleCreateUser} className="data-form">
          <label>
            E-Mail*
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
            />
          </label>
          <label>
            Anzeigename
            <input
              name="displayName"
              type="text"
              value={form.displayName}
              onChange={handleChange}
            />
          </label>
          <label>
            Startpasswort (optional)
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
          </label>
          <label>
            Rolle
            <select name="role" value={form.role} onChange={handleChange}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="form-buttons">
            <button type="submit">Benutzer anlegen</button>
          </div>
        </form>
      </section>

      <section className="list-section" style={{ marginTop: 24 }}>
        <h3>Bestehende Benutzer</h3>
        {loading && <p>Lade Benutzer...</p>}
        {!loading && users.length === 0 && <p>Noch keine Benutzer angelegt.</p>}
        {!loading && users.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>E-Mail</th>
                <th>Anzeigename</th>
                <th>Rolle</th>
                <th>Rechte</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.displayName || '-'}</td>
                  <td>
                    <select
                      value={u.role || 'readonly'}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="permissions-grid">
                      {[
                        'absences',
                        'roadworks',
                        'charter',
                        'appointments',
                        'medicalAppointments',
                        'notices',
                        'todos',
                        'trainings',
                      ].map(
                        (area) => {
                          const p = (u.permissions || {})[area] || { view: true, edit: false };
                          return (
                            <div key={area} className="permission-row">
                              <span className="permission-label">{labelForArea(area)}</span>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={!!p.view}
                                  onChange={() => togglePermission(u, area, 'view')}
                                />
                                sehen
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={!!p.edit}
                                  onChange={() => togglePermission(u, area, 'edit')}
                                />
                                bearbeiten
                              </label>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => handleDeleteUser(u)}>
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default UserManagementView;
