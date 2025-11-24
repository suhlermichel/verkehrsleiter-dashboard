// Zentrale Stelle für erlaubte Dateitypen und maximale Größe
// Hier kannst du später bei Bedarf Typen/Größe anpassen.

export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function detectFileType(file) {
  const name = file?.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return 'other';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image';
  return 'other';
}

export function validateFile(file) {
  if (!file) {
    return { ok: false, error: 'Bitte wähle eine Datei aus.' };
  }
  const type = detectFileType(file);
  if (!ALLOWED_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() || '')) {
    return {
      ok: false,
      error: 'Nur Dateien vom Typ PDF, PNG oder JPG/JPEG sind erlaubt.',
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: 'Die Datei ist größer als 10 MB. Bitte eine kleinere Datei wählen.',
    };
  }
  return { ok: true, error: null, fileType: type };
}

export function createAttachmentMetadata({ id, file, url, storagePath, fileType, uploadedAt }) {
  return {
    id,
    fileName: file.name,
    fileUrl: url,
    fileType,
    storagePath,
    uploadedAt,
  };
}
