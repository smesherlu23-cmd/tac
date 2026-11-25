import type { Doc } from './types';

const DB = 'tactic';
const STORE = 'kv';

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveAutosave(doc: Doc, filePath: string | null) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ doc, filePath, at: Date.now() }, 'autosave');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadAutosave(): Promise<{ doc: Doc; filePath: string | null } | null> {
  try {
    const d = await db();
    return await new Promise((res) => {
      const r = d.transaction(STORE).objectStore(STORE).get('autosave');
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}
