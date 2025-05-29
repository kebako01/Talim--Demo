// db.js
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';

export const dbPromise = openDB('skills-trainer', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});
