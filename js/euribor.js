/* =============================================
   js/euribor.js — Euríbor en tiempo real
   Fuente: API oficial del BCE (gratis, sin API key)
   Nota: el BCE solo publica Euribor mensual (promedio del mes)
         en su API pública. No existe serie diaria en el dataflow FM.
   ============================================= */

'use strict';

const Euribor = (() => {

    // Endpoints BCE para distintos plazos (frecuencia mensual: M)
    // El BCE publica el valor promedio del mes. El dato más reciente
    // disponible suele ser el ultimo mes ya cerrado (con ~1 semana de delay).
    const ENDPOINTS = {
        '1m': 'FM/M.U2.EUR.RT.MM.EURIBOR1MD_.HSTA',
        '3m': 'FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA',
        '6m': 'FM/M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA',
        '12m': 'FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA',
    };
    const BASE = 'https://data-api.ecb.europa.eu/service/data';
    const CACHE_KEY = 'euribor-cache';

    // Extrae el valor y el periodo de la respuesta del BCE
    function parseResponse(json) {
        const obs = json?.dataSets?.[0]?.series?.['0:0:0:0:0:0:0']?.observations;
        const period = json?.structure?.dimensions?.observation?.[0]?.values?.[0]?.id;
        if (!obs) return null;
        const value = obs['0']?.[0];
        return value !== undefined ? { value: parseFloat(value.toFixed(4)), period } : null;
    }

    // Obtiene el Euríbor de un plazo concreto
    async function fetch(term = '12m') {
        const path = ENDPOINTS[term];
        if (!path) throw new Error(`Plazo desconocido: ${term}`);
        const url = `${BASE}/${path}?lastNObservations=1&format=jsondata`;
        const res = await window.fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`BCE API error ${res.status}`);
        const json = await res.json();
        return parseResponse(json);
    }

    // Obtiene todos los plazos a la vez (en paralelo)
    async function fetchAll() {
        const terms = Object.keys(ENDPOINTS);
        const results = await Promise.allSettled(terms.map(t => fetch(t)));
        const data = {};
        terms.forEach((t, i) => {
            if (results[i].status === 'fulfilled') data[t] = results[i].value;
        });
        return data;
    }

    // Guarda caché en IndexedDB (válida 6 horas)
    async function getCached() {
        try {
            const cached = await DB.load(CACHE_KEY);
            if (!cached) return null;
            const age = Date.now() - cached.timestamp;
            if (age > 6 * 60 * 60 * 1000) return null; // > 6h → expirado
            return cached.data;
        } catch { return null; }
    }

    async function setCache(data) {
        try { await DB.save(CACHE_KEY, { data, timestamp: Date.now() }); } catch { }
    }

    // API pública principal: carga con caché
    async function load() {
        const cached = await getCached();
        if (cached) return cached;
        const fresh = await fetchAll();
        await setCache(fresh);
        return fresh;
    }

    return { fetch, fetchAll, load };
})();
