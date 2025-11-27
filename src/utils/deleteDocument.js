// Zentrale Löschfunktion für Firestore-Dokumente (Hard Delete).
// Hinweis: Für kritische Bereiche wie Baustellen und Gelegenheitsfahrten
// ist eine Archivierung oder dokumentierte Historie oft die bessere Wahl.
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

export async function deleteDocument(collectionName, id) {
  if (!collectionName || !id) return;
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
}
