import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth/AuthContext.jsx';

function DashboardTiles({ activeTab, setActiveTab }) {
  const { canView } = useAuth();
  const [counts, setCounts] = useState({
    absences: 0,
    roadworks: 0,
    charterTrips: 0,
    appointments: 0,
    todos: 0,
    trainings: 0,
  });

  useEffect(() => {
    const unsubAbs = onSnapshot(collection(db, 'absences'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        absences: data.filter((i) => !i.archived).length,
      }));
    });

    const unsubRoad = onSnapshot(collection(db, 'roadworks'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        roadworks: data.filter((i) => !i.archived).length,
      }));
    });

    const unsubCharter = onSnapshot(collection(db, 'charterTrips'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        charterTrips: data.filter((i) => !i.archived).length,
      }));
    });

    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        appointments: data.filter((i) => !i.archived).length,
      }));
    });

    const unsubTodos = onSnapshot(collection(db, 'todos'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        todos: data.filter((i) => !i.archived).length,
      }));
    });

    const unsubTrainings = onSnapshot(collection(db, 'trainings'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setCounts((prev) => ({
        ...prev,
        trainings: data.filter((i) => !i.archived).length,
      }));
    });

    return () => {
      unsubAbs();
      unsubRoad();
      unsubCharter();
      unsubAppointments();
      unsubTodos();
      unsubTrainings();
    };
  }, []);

  return (
    <div className="dashboard-tiles">
      {canView('absences') && (
        <button
        type="button"
        className={
          activeTab === 'absences'
            ? 'dashboard-tile tile-absences tile-active'
            : 'dashboard-tile tile-absences'
        }
        onClick={() => setActiveTab('absences')}
      >
        <div className="tile-icon">📒</div>
        <div className="tile-number">{counts.absences}</div>
        <div className="tile-text">Abwesenheiten (krank)</div>
      </button>
      )}
      {canView('roadworks') && (
        <button
        type="button"
        className={
          activeTab === 'roadworks'
            ? 'dashboard-tile tile-roadworks tile-active'
            : 'dashboard-tile tile-roadworks'
        }
        onClick={() => setActiveTab('roadworks')}
      >
        <div className="tile-icon">🚧</div>
        <div className="tile-number">{counts.roadworks}</div>
        <div className="tile-text">Baustellen-Alarme</div>
      </button>
      )}
      {canView('charter') && (
        <button
        type="button"
        className={
          activeTab === 'charter'
            ? 'dashboard-tile tile-charter tile-active'
            : 'dashboard-tile tile-charter'
        }
        onClick={() => setActiveTab('charter')}
      >
        <div className="tile-icon">🚌</div>
        <div className="tile-number">{counts.charterTrips}</div>
        <div className="tile-text">Gelegenheitsfahrten</div>
      </button>
      )}
      {canView('appointments') && (
        <button
        type="button"
        className={
          activeTab === 'appointments'
            ? 'dashboard-tile tile-appointments tile-active'
            : 'dashboard-tile tile-appointments'
        }
        onClick={() => setActiveTab('appointments')}
      >
        <div className="tile-icon">📅</div>
        <div className="tile-number">{counts.appointments}</div>
        <div className="tile-text">Wichtige Termine</div>
      </button>
      )}
      {canView('todos') && (
        <button
        type="button"
        className={
          activeTab === 'todos'
            ? 'dashboard-tile tile-todos tile-active'
            : 'dashboard-tile tile-todos'
        }
        onClick={() => setActiveTab('todos')}
      >
        <div className="tile-icon">✅</div>
        <div className="tile-number">{counts.todos}</div>
        <div className="tile-text">Offene To-Dos</div>
      </button>
      )}
      {canView('trainings') && (
        <button
        type="button"
        className={
          activeTab === 'trainings'
            ? 'dashboard-tile tile-trainings tile-active'
            : 'dashboard-tile tile-trainings'
        }
        onClick={() => setActiveTab('trainings')}
      >
        <div className="tile-icon">📚</div>
        <div className="tile-number">{counts.trainings}</div>
        <div className="tile-text">Schulungen</div>
      </button>
      )}
    </div>
  );
}

export default DashboardTiles;
