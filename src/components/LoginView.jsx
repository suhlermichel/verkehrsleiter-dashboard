import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

function LoginView() {
  const { signIn, resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError('Anmeldung fehlgeschlagen. Bitte E-Mail/Passwort prüfen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setError('');
    setResetMessage('');
    if (!email) {
      setError('Bitte geben Sie zuerst Ihre E-Mail-Adresse ein.');
      return;
    }
    try {
      await resetPassword(email);
      setResetMessage('Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet.');
    } catch (err) {
      setError('Passwort-Reset fehlgeschlagen. Bitte E-Mail prüfen.');
    }
  }

  return (
    <div className="section-root" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Anmeldung</h2>
      <p>Bitte mit E-Mail und Passwort anmelden, um das Dashboard zu nutzen.</p>
      <form onSubmit={handleSubmit} className="data-form">
        <label>
          E-Mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        {resetMessage && <p>{resetMessage}</p>}
        <div className="form-buttons">
          <button type="submit" disabled={busy || loading}>
            {busy ? 'Bitte warten…' : 'Anmelden'}
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={handleResetPassword}
          >
            Passwort vergessen?
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginView;
