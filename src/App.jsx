import React, { useState } from 'react';
import AbsencesView from './components/AbsencesView.jsx';
import RoadworksView from './components/RoadworksView.jsx';
import CharterTripsView from './components/CharterTripsView.jsx';
import CalendarView from './components/CalendarView.jsx';
import DashboardTiles from './components/DashboardTiles.jsx';
import AppointmentsView from './components/AppointmentsView.jsx';
import TodosView from './components/TodosView.jsx';
import TrainingsView from './components/TrainingsView.jsx';
import UserManagementView from './components/UserManagementView.jsx';
import KiAssistantView from './components/KiAssistantView.jsx';
import LoginView from './components/LoginView.jsx';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';

function AppShell() {
  const [activeTab, setActiveTab] = useState('calendar');
  const { firebaseUser, role, canView, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-root">
        <header className="app-header">
          <div className="app-header-main">
            <div>
              <h1>SNG-Verkehrsleitung Dashboard (Version 1.6)</h1>
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
      <div className="app-root">
        <header className="app-header">
          <div className="app-header-main">
            <div>
              <h1>SNG-Verkehrsleitung Dashboard (Version 1.4)</h1>
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
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-main">
          <div>
            <h1>SNG-Verkehrsleitung Dashboard (Version 1.4)</h1>
            <p>Einfache interne Übersicht für Abwesenheiten, Baustellen, Fahrten und Planung</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        {activeTab === 'todos' && canView('todos') && <TodosView />}
        {activeTab === 'trainings' && canView('trainings') && <TrainingsView />}
        {activeTab === 'assistant' && role === 'admin' && <KiAssistantView />}
        {activeTab === 'users' && role === 'admin' && <UserManagementView />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
