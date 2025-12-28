import React, { useEffect, useState } from 'react';
import AbsencesView from './components/AbsencesView.jsx';
import RoadworksView from './components/RoadworksView.jsx';
import CharterTripsView from './components/CharterTripsView.jsx';
import CalendarView from './components/CalendarView.jsx';
import DashboardTiles from './components/DashboardTiles.jsx';
import AppointmentsView from './components/AppointmentsView.jsx';
import MedicalAppointmentsView from './components/MedicalAppointmentsView.jsx';
import NoticesView from './components/NoticesView.jsx';
import TodosView from './components/TodosView.jsx';
import TrainingsView from './components/TrainingsView.jsx';
import UserManagementView from './components/UserManagementView.jsx';
import KiAssistantView from './components/KiAssistantView.jsx';
import LoginView from './components/LoginView.jsx';
import ServiceMessagesView from './components/ServiceMessagesView.jsx';
import FahrdienstDashboardView from './components/FahrdienstDashboardView.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';

function AppShell() {
  // Version 1.7: Zuletzt aktiven Reiter im localStorage merken,
  // damit nach einem Reload nicht immer der Kalender startet.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return window.localStorage.getItem('active_tab') || 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = window.localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      // Standardmäßig Dark-Theme nutzen, damit Optik näher am Fahrdienst-Dashboard ist.
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
      return true;
    } catch {
      return true;
    }
  });
  const { firebaseUser, role, canView, signOut, loading } = useAuth();

  useEffect(() => {
    try {
      window.localStorage.setItem('active_tab', activeTab);
    } catch {
      // Ignorieren, falls localStorage nicht verfügbar ist.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignorieren, falls localStorage nicht verfügbar ist.
    }
  }, [isDarkMode]);

  if (loading) {
    return (
      <div className={"app-root " + (isDarkMode ? 'theme-dark' : 'theme-light')}>
        <header className="app-header">
          <div className="app-header-main">
            <div>
              <h1>SNG-Verkehrsleitung Dashboard (Version 1.9)</h1>
              <p>Einfache interne Übersicht für Abwesenheiten, Baustellen, Fahrten und Planung</p>
            </div>
          </div>
        </header>
        <main className="app-main">
          <p>Lade Benutzerdaten...</p>
        </main>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className={"app-root " + (isDarkMode ? 'theme-dark' : 'theme-light')}>
        <header className="app-header">
          <div className="app-header-main">
            <div>
              <h1>SNG-Verkehrsleitung Dashboard (Version 1.9)</h1>
              <p>Einfache interne Übersicht für Abwesenheiten, Baustellen, Fahrten und Planung</p>
            </div>
          </div>
        </header>
        <main className="app-main">
          <LoginView />
        </main>
      </div>
    );
  }

  return (
    <div className={"app-root " + (isDarkMode ? 'theme-dark' : 'theme-light')}>
      <header className="app-header">
        <div className="app-header-main">
          <div>
            <h1>SNG-Verkehrsleitung Dashboard (Version 1.9)</h1>
            <p>Einfache interne Übersicht für Abwesenheiten, Baustellen, Fahrten und Planung</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
            >
              {isDarkMode ? 'Dark' : 'Light'}
            </button>
            <span>{firebaseUser.email}</span>
            <button type="button" onClick={signOut}>
              Abmelden
            </button>
            <img src="/sng-logo.png" alt="SNG Logo" className="app-logo" />
          </div>
        </div>
      </header>

      <DashboardTiles activeTab={activeTab} setActiveTab={setActiveTab} />

      <nav className="app-tabs">
        <button
          className={activeTab === 'calendar' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('calendar')}
        >
          Kalender
        </button>
        {canView('absences') && (
          <button
            className={activeTab === 'absences' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('absences')}
          >
            Abwesenheiten
          </button>
        )}
        {canView('roadworks') && (
          <button
            className={activeTab === 'roadworks' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('roadworks')}
          >
            Baustellen
          </button>
        )}
        {canView('charter') && (
          <button
            className={activeTab === 'charter' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('charter')}
          >
            Gelegenheitsfahrten
          </button>
        )}
        {canView('appointments') && (
          <button
            className={activeTab === 'appointments' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('appointments')}
          >
            Termine
          </button>
        )}
        {canView('medicalAppointments') && (
          <button
            className={activeTab === 'medicalAppointments' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('medicalAppointments')}
          >
            Termine Betriebsarzt
          </button>
        )}
        {canView('notices') && (
          <button
            className={activeTab === 'notices' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('notices')}
          >
            Dienstanweisungen & Aushänge
          </button>
        )}
        {canView('serviceMessages') && (
          <button
            className={activeTab === 'serviceMessages' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('serviceMessages')}
          >
            Informationen Fahrer-Dashboard
          </button>
        )}
        {canView('todos') && (
          <button
            className={activeTab === 'todos' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('todos')}
          >
            To-Dos
          </button>
        )}
        {canView('trainings') && (
          <button
            className={activeTab === 'trainings' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('trainings')}
          >
            Schulungen
          </button>
        )}
        {role === 'admin' && (
          <button
            className={activeTab === 'assistant' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('assistant')}
          >
            KI-Assistent
          </button>
        )}
        {role === 'admin' && (
          <button
            className={activeTab === 'users' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('users')}
          >
            Benutzerverwaltung
          </button>
        )}
      </nav>

      <main className={`app-main main-${activeTab}`}>
        {activeTab === 'absences' && canView('absences') && <AbsencesView />}
        {activeTab === 'roadworks' && canView('roadworks') && <RoadworksView />}
        {activeTab === 'charter' && canView('charter') && <CharterTripsView />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'appointments' && canView('appointments') && <AppointmentsView />}
      {activeTab === 'medicalAppointments' && canView('medicalAppointments') && (
        <MedicalAppointmentsView />
      )}
      {activeTab === 'notices' && canView('notices') && <NoticesView />}
      {activeTab === 'serviceMessages' && canView('serviceMessages') && <ServiceMessagesView />}
        {activeTab === 'todos' && canView('todos') && <TodosView />}
        {activeTab === 'trainings' && canView('trainings') && <TrainingsView />}
        {activeTab === 'assistant' && role === 'admin' && <KiAssistantView />}
        {activeTab === 'users' && role === 'admin' && <UserManagementView />}
      </main>
    </div>
  );
}

function FahrdienstShell() {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="fahrdienst-root">
        <p>Lade Benutzerdaten...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="fahrdienst-root">
        <LoginView />
      </div>
    );
  }

  return <FahrdienstDashboardView />;
}

function App() {
  const path = window.location.pathname || '/';

  if (path === '/fahrdienst') {
    return (
      <AuthProvider>
        <FahrdienstShell />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
