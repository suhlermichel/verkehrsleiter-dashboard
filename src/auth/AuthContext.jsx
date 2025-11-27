import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS_BY_ROLE = {
  admin: {
    absences: { view: true, edit: true },
    roadworks: { view: true, edit: true },
    charter: { view: true, edit: true },
    appointments: { view: true, edit: true },
    medicalAppointments: { view: true, edit: true },
    notices: { view: true, edit: true },
    todos: { view: true, edit: true },
    trainings: { view: true, edit: true },
  },
  verkehrsleiter: {
    absences: { view: true, edit: true },
    roadworks: { view: true, edit: true },
    charter: { view: true, edit: true },
    appointments: { view: true, edit: true },
    medicalAppointments: { view: true, edit: true },
    todos: { view: true, edit: true },
    trainings: { view: true, edit: true },
  },
  ueberwachung: {
    absences: { view: true, edit: false },
    roadworks: { view: true, edit: false },
    charter: { view: true, edit: false },
    appointments: { view: true, edit: false },
    medicalAppointments: { view: true, edit: false },
    notices: { view: true, edit: false },
    todos: { view: true, edit: false },
    trainings: { view: true, edit: false },
  },
  readonly: {
    absences: { view: true, edit: false },
    roadworks: { view: true, edit: false },
    charter: { view: true, edit: false },
    appointments: { view: true, edit: false },
    medicalAppointments: { view: true, edit: false },
    todos: { view: true, edit: false },
    trainings: { view: true, edit: false },
  },
  vertretung_verkehrsleiter: {
    absences: { view: true, edit: false },
    roadworks: { view: true, edit: false },
    charter: { view: true, edit: false },
    appointments: { view: true, edit: false },
    medicalAppointments: { view: true, edit: false },
    todos: { view: true, edit: false },
    trainings: { view: true, edit: false },
  },
  personalabteilung: {
    absences: { view: true, edit: false },
    roadworks: { view: true, edit: false },
    charter: { view: true, edit: false },
    appointments: { view: true, edit: false },
    medicalAppointments: { view: true, edit: false },
    todos: { view: true, edit: false },
    trainings: { view: true, edit: false },
  },
  benutzer: {
    absences: { view: true, edit: false },
    roadworks: { view: true, edit: false },
    charter: { view: true, edit: false },
    appointments: { view: true, edit: false },
    medicalAppointments: { view: true, edit: false },
    todos: { view: true, edit: false },
    trainings: { view: true, edit: false },
  },
};

function mergePermissions(role, customPermissions) {
  const base = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.readonly;
  if (!customPermissions) return base;
  const merged = { ...base };
  Object.keys(base).forEach((key) => {
    merged[key] = { ...base[key], ...(customPermissions[key] || {}) };
  });
  return merged;
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserDoc(null);
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        const docSnap = snap.docs[0];
        setUserDoc(docSnap ? { id: docSnap.id, ...docSnap.data() } : null);
      } catch (e) {
        // im Fehlerfall lieber defensiv: kein UserDoc
        setUserDoc(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(() => {
    const role = userDoc?.role || 'readonly';
    const permissions = mergePermissions(role, userDoc?.permissions || {});

    function canView(area) {
      return !!permissions[area]?.view;
    }

    function canEdit(area) {
      return !!permissions[area]?.edit;
    }

    async function signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    }

    async function signOut() {
      await fbSignOut(auth);
    }

    async function resetPassword(email) {
      await sendPasswordResetEmail(auth, email);
    }

    return {
      firebaseUser,
      userDoc,
      role,
      permissions,
      canView,
      canEdit,
      signIn,
      signOut,
      resetPassword,
      loading,
    };
  }, [firebaseUser, userDoc, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
