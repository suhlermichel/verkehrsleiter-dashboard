# Deployment-Anleitung: Verkehrsleiter-Dashboard auf Vercel

Diese Anleitung beschreibt Schritt für Schritt, wie du dein bestehendes Verkehrsleiter-Dashboard
(React + Vite + Firebase) bei **Vercel** veröffentlichst und mit **Firebase (Auth + Firestore)**
von überall nutzen kannst.

---

## 1. Technische Basis des Projekts

- Frontend-Framework: **React**
- Build-Tool / Dev-Server: **Vite**
- Backend-/Datenhaltung: **Firebase** (Authentication, Firestore, Storage)
- Build-Befehl: `npm run build`
- Build-Output-Verzeichnis: `dist`
- Die App läuft als **Single Page Application (SPA)** auf Vercel.

Du musst an der Fachlogik (Abwesenheiten, Baustellen, Kalender, Rollen etc.) nichts ändern.

---

## 2. Voraussetzungen

Bevor du startest, solltest du Folgendes haben:

1. **GitHub-Account**
   - Kostenlos unter https://github.com anlegen.

2. **Vercel-Account**
   - Kostenlos unter https://vercel.com anlegen (Login z. B. mit GitHub möglich).

3. **Firebase-Projekt** mit
   - **Cloud Firestore** aktiviert
   - **Authentication** mit E-Mail/Passwort aktiviert
   - Optional: **Storage** (für Dateianhänge), bereits im Projekt genutzt

4. **Node.js + npm** lokal installiert
   - Überprüfen mit `node -v` und `npm -v` im Terminal.

---

## 3. Umgebungsvariablen lokal einrichten

Die App nutzt Umgebungsvariablen für die Firebase- und OpenAI-Konfiguration.

1. Im Projektordner findest du die Datei **`.env.example`**.
2. Kopiere diese Datei und benenne die Kopie in **`.env.local`** um:

   ```bash
   cp .env.example .env.local
   ```

3. Öffne `.env.local` und trage deine echten Werte ein:

   ```ini
   VITE_FIREBASE_API_KEY=DEIN_API_KEY_HIER
   VITE_FIREBASE_AUTH_DOMAIN=DEINE_AUTH_DOMAIN_HIER
   VITE_FIREBASE_PROJECT_ID=DEIN_PROJEKT_ID_HIER
   VITE_FIREBASE_STORAGE_BUCKET=DEIN_STORAGE_BUCKET_HIER
   VITE_FIREBASE_MESSAGING_SENDER_ID=DEINE_SENDER_ID_HIER
   VITE_FIREBASE_APP_ID=DEINE_APP_ID_HIER

   VITE_OPENAI_API_KEY=DEIN_OPENAI_API_KEY_HIER
   ```

   Diese Daten bekommst du in der **Firebase Console** unter
   „Projekteinstellungen → Allgemein → Deine Apps → Web-App“.

4. Wichtig: **`.env.local` wird nicht in Git committed** (siehe `.gitignore`).
   - Die Datei bleibt nur auf deinem Rechner.

---

## 4. Projekt lokal testen und bauen

1. Im Projektordner (z. B. `verkehrsleiter-dashboard`) im Terminal:

   ```bash
   npm install
   npm run dev
   ```

   - Dann im Browser `http://localhost:5173` öffnen (Standard-Port von Vite).

2. Wenn alles funktioniert, kannst du den Produktions-Build testen:

   ```bash
   npm run build
   ```

   - Der fertige Build landet im Ordner **`dist`**.

3. Optional kannst du den Build lokal mit Vite-Preview ansehen:

   ```bash
   npm run preview
   ```

---

## 5. Projekt zu GitHub hochladen

1. **Git im Projekt initialisieren** (falls noch nicht geschehen):

   ```bash
   git init
   git add .
   git commit -m "Initial commit Verkehrsleiter-Dashboard"
   ```

2. Auf https://github.com ein neues Repository anlegen
   - Name z. B. `verkehrsleiter-dashboard`
   - Öffentlich oder privat – beides ist möglich.

3. Das lokale Projekt mit GitHub verbinden (Befehle werden dir von GitHub angezeigt), z. B.:

   ```bash
   git remote add origin https://github.com/DEIN_USER/verkehrsleiter-dashboard.git
   git push -u origin main
   ```

   (Branch-Name kann auch `master` heißen – passe ihn ggf. an.)

> Achtung: Stelle sicher, dass **keine echten Schlüssel** in den Code-Dateien stehen.
> Alles sollte über `.env.local` laufen.

---

## 6. Vercel-Projekt anlegen und deployen

1. Auf https://vercel.com einloggen.
2. Rechts oben auf **„New Project“** klicken.
3. Unter **„Import Git Repository“** dein GitHub-Repo auswählen
   (z. B. `verkehrsleiter-dashboard`).
4. Vercel erkennt in der Regel **Vite + React** automatisch. Prüfe folgende Einstellungen:

   - **Framework Preset:** `Vite` (oder `React` mit Vite)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

5. Auf **„Deploy“** klicken.

6. Nach einigen Sekunden sollte der Build durchlaufen. Am Ende bekommst du eine URL, z. B.:

   ```text
   https://verkehrsleiter-dashboard.vercel.app
   ```

   Notiere dir diese URL – hier wird deine App später öffentlich erreichbar sein.

---

## 7. Umgebungsvariablen bei Vercel setzen

Damit die App im Deployment mit Firebase (und dem KI-Assistenten) funktioniert, musst du
alle benötigten Variablen auch bei Vercel hinterlegen.

1. In Vercel in deinem Projekt auf **„Settings“** gehen.
2. Links im Menü **„Environment Variables“** auswählen.
3. Trage alle Variablen aus deiner `.env.local` ein, z. B.:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_OPENAI_API_KEY`

4. Nach dem Speichern der Variablen ggf. einen neuen Deploy auslösen:
   - Menü **„Deployments“** → Knopf **„Redeploy“**.

---

## 8. Firestore-Regeln in Firebase setzen

Damit deine Daten sicher sind, solltest du Firestore so konfigurieren, dass nur
angemeldete Nutzer lesen und schreiben dürfen.

1. Im Projektordner findest du die Datei **`firestore.rules.example`**.
2. Öffne diese Datei – dort steht z. B.:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Zugriff nur für eingeloggte Nutzer
       match /{document=**} {
         allow read, write: if request.auth != null;
       }

     }
   }
   ```

3. Gehe in der **Firebase Console** zu:
   - „Firestore Database“ → Reiter **„Regeln“**.
4. Ersetze die vorhandenen Regeln durch den Inhalt aus `firestore.rules.example`.
5. Klicke auf **„Veröffentlichen“**.

> Hinweis: Änderungen an Firestore-Regeln wirken sich direkt auf dein Live-Projekt aus.
> Ändere produktive Regeln nur, wenn du weißt, was du tust.

---

## 9. App nach dem Deployment testen

1. Öffne die Vercel-URL deiner App (z. B. `https://verkehrsleiter-dashboard.vercel.app`).
2. Versuche, dich mit einem gültigen Benutzer einzuloggen
   (E-Mail/Passwort aus deiner Firebase Authentication).
3. Prüfe, ob folgende Dinge funktionieren:
   - **Lesen**: Abwesenheiten, Baustellen, Kalender, Schulungen, To-Dos, Termine etc. werden angezeigt.
   - **Schreiben**: z. B. eine neue Abwesenheit anlegen oder bearbeiten.
   - **Anhänge**: Upload/Download von Dateien (sofern konfiguriert).
   - **KI-Assistent**: Briefing und Fragen funktionieren (sofern VITE_OPENAI_API_KEY gesetzt ist).

Wenn etwas nicht funktioniert:

- Prüfe die **Browser-Konsole** (F12 → Console) auf Fehlermeldungen.
- Prüfe die **Vercel-Logs** im Projekt → „Deployments“.
- Überprüfe, ob alle Environment Variables korrekt gesetzt sind.

---

## 10. Sicherheit und gute Praxis

- **Geheime Schlüssel niemals committen**:
  - `.env`, `.env.local` und andere Env-Dateien stehen in `.gitignore` und werden nicht
    zu GitHub hochgeladen.
  - Firebase- und OpenAI-Keys gehören nur in `.env.local` bzw. in Vercel Environment Variables.

- **Nur angemeldete Nutzer**:
  - In den Firestore-Regeln wird `request.auth != null` verwendet.
  - Das bedeutet: Nur Benutzer, die über Firebase Authentication eingeloggt sind, können
    Daten lesen oder schreiben.

- **Single Page Application (SPA)**:
  - Die App läuft als SPA auf Vercel. Routing und Logik passieren im Browser.
  - Das Backend ist Firestore/Storage/Auth von Firebase.

Damit solltest du dein Verkehrsleiter-Dashboard sicher und reproduzierbar bei Vercel
bereitstellen können – ohne tief in Build- oder Servertechnik einsteigen zu müssen.
