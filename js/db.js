/* =============================================
   js/db.js — Capa IndexedDB
   Guarda el estado de la app y la config de Gist
   localmente en el navegador.
   ============================================= */

'use strict';

const DB = (() => {
    const DB_NAME = 'bancocomp';
    const DB_VERSION = 1;
    const STORE = 'kv';

    let _db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE);
                }
            };
            req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function save(key, value) {
        await open();
        return new Promise((resolve, reject) => {
            const tx = _db.transaction(STORE, 'readwrite');
            const req = tx.objectStore(STORE).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function load(key) {
        await open();
        return new Promise((resolve) => {
            const tx = _db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = (e) => resolve(e.target.result ?? null);
            req.onerror = () => resolve(null);
        });
    }

    async function remove(key) {
        await open();
        return new Promise((resolve) => {
            const tx = _db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
            tx.oncomplete = () => resolve();
        });
    }

    return { open, save, load, remove };
})();
