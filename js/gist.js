/* =============================================
   js/gist.js — GitHub Gist Sync
   Permite guardar y recuperar el estado de la app
   en un Gist privado de GitHub usando un PAT.
   ============================================= */

'use strict';

const Gist = (() => {
    const API = 'https://api.github.com';
    const GIST_FILE = 'bancocomp-data.json';
    const DESCRIPTION = 'BancoComp — datos de comparativa hipotecas';

    let _token = null;
    let _gistId = null;

    // ─── Config ────────────────────────────────
    function setToken(token) { _token = token; }
    function setGistId(id) { _gistId = id; }
    function getToken() { return _token; }
    function getGistId() { return _gistId; }
    function isConfigured() { return !!_token; }

    // ─── HTTP helper ───────────────────────────
    async function request(method, path, body) {
        const res = await fetch(`${API}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${_token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `GitHub API error ${res.status}`);
        }
        return res.status === 204 ? null : res.json();
    }

    // ─── Crear nuevo Gist ──────────────────────
    async function create(data) {
        const res = await request('POST', '/gists', {
            description: DESCRIPTION,
            public: false,
            files: {
                [GIST_FILE]: { content: JSON.stringify(data, null, 2) },
            },
        });
        _gistId = res.id;
        return res.id;
    }

    // ─── Leer Gist ─────────────────────────────
    async function read() {
        if (!_gistId) return null;
        const res = await request('GET', `/gists/${_gistId}`);
        const content = res.files?.[GIST_FILE]?.content;
        if (!content) return null;
        return JSON.parse(content);
    }

    // ─── Actualizar Gist ───────────────────────
    async function write(data) {
        if (!_gistId) {
            // Si no hay ID todavía, crear uno nuevo
            await create(data);
            return;
        }
        await request('PATCH', `/gists/${_gistId}`, {
            files: {
                [GIST_FILE]: { content: JSON.stringify(data, null, 2) },
            },
        });
    }

    // ─── Validar token ─────────────────────────
    async function validateToken(token) {
        const res = await fetch(`${API}/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!res.ok) throw new Error('Token inválido o sin permisos');
        const user = await res.json();
        return user.login; // devuelve el username de GitHub
    }

    return {
        setToken, setGistId,
        getToken, getGistId,
        isConfigured,
        create, read, write,
        validateToken,
    };
})();
