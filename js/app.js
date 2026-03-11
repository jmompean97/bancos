/* =============================================
   js/app.js — Orquestador principal
   Estado, eventos, coordinación DB + Gist + UI
   ============================================= */

'use strict';

const App = (() => {

    const COLORS = 6;

    // ─── Estado ────────────────────────────────
    const state = {
        conditions: null,
        banks: [],
        editingIndex: null,
        hiddenBanks: new Set(), // indices de bancos ocultos en la tabla
    };

    // ─── Persistencia: guarda local + Gist ─────
    // Debounce + mutex para evitar PATCHes concurrentes (409 Conflict)
    let _gistDebounceTimer = null;
    let _gistWriting = false;
    let _gistPending = false;

    async function _flushGist() {
        if (_gistWriting) {
            // Hay un PATCH en curso: marcar que hay datos pendientes y salir
            _gistPending = true;
            return;
        }
        _gistWriting = true;
        _gistPending = false;
        const data = {
            conditions: state.conditions,
            banks: state.banks,
            hiddenBanks: [...state.hiddenBanks],
        };
        UI.setSyncStatus('syncing');
        try {
            await Gist.write(data);
            UI.setSyncStatus('synced');
        } catch (err) {
            console.error('Gist sync error:', err);
            UI.setSyncStatus('error');
            UI.showToast(`⚠️ Error al sincronizar: ${err.message}`, 'error');
        } finally {
            _gistWriting = false;
            // Si mientras escribíamos llegaron más cambios, volver a enviar
            if (_gistPending) {
                _gistPending = false;
                _flushGist();
            }
        }
    }

    function _scheduleGistWrite() {
        clearTimeout(_gistDebounceTimer);
        _gistDebounceTimer = setTimeout(_flushGist, 800);
    }

    async function persist() {
        const data = {
            conditions: state.conditions,
            banks: state.banks,
            hiddenBanks: [...state.hiddenBanks],  // Set → Array para JSON
        };
        // 1. Siempre guardar en IndexedDB (local, inmediato)
        await DB.save('session', data);
        // 2. Si hay Gist configurado, encolar escritura en la nube
        if (Gist.isConfigured()) {
            _scheduleGistWrite();
        }
    }

    function refresh() {
        UI.renderBanksGrid(state.banks);
        const visibleBanks = state.banks.filter((_, i) => !state.hiddenBanks.has(i));
        UI.renderBankFilter(state.banks, state.hiddenBanks);
        UI.renderCompareTable(visibleBanks, state.conditions);
    }

    async function persistAndRefresh() {
        await persist();
        refresh();
    }

    // ─── Condiciones ────────────────────────────
    async function saveConditions() {
        const importe = parseFloat(document.getElementById('importe').value);
        const inmueble = parseFloat(document.getElementById('valor-inmueble').value);
        const plazo = parseInt(document.getElementById('plazo').value);
        if (!importe || !plazo) {
            UI.showToast('Introduce al menos el importe y el plazo', 'error');
            return;
        }
        state.conditions = { importe, inmueble, plazo };
        UI.applyConditionsToUI(state.conditions);
        UI.showToast('✓ Condiciones guardadas', 'success');
        await persistAndRefresh();
    }

    // ─── Modal banco ────────────────────────────
    function openAddBankModal() {
        state.editingIndex = null;
        document.getElementById('modal-title').textContent = 'Añadir banco';
        clearModalForm();
        switchTab('fija');
        document.getElementById('modal-overlay').classList.add('open');
        document.getElementById('bank-name').focus();
    }

    function openEditBankModal(index) {
        state.editingIndex = index;
        document.getElementById('modal-title').textContent = 'Editar banco';
        loadBankIntoForm(state.banks[index]);
        switchTab('fija');
        document.getElementById('modal-overlay').classList.add('open');
    }

    function closeBankModal() {
        document.getElementById('modal-overlay').classList.remove('open');
        state.editingIndex = null;
    }

    function closeModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay')) closeBankModal();
    }

    function switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        document.getElementById('panel-' + tab).classList.add('active');
    }

    // ─── Form helpers ───────────────────────────
    function gv(id) {
        const el = document.getElementById(id);
        return el ? (el.value.trim() === '' ? null : el.value.trim()) : null;
    }
    function sv(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val !== null && val !== undefined ? val : '';
    }
    function sc(id, val) {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    }

    function clearModalForm() {
        ['bank-name',
            'fija-bon-interes', 'fija-bon-cuota', 'fija-bon-total',
            'fija-nobon-interes', 'fija-nobon-cuota', 'fija-nobon-total',
            'fija-nobon-amort-0-10', 'fija-nobon-amort-resto',
            'gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd', 'gasto-apertura', 'gasto-extras', 'gasto-notas',
            'bon-nomina-reduction', 'bon-vida-reduction', 'bon-hogar-reduction', 'bon-tarjeta-reduction',
            'bon-vida-coste', 'bon-hogar-coste', 'bon-tarjeta-coste',
            'bon-alarma-reduction', 'bon-alarma-coste',
            'bon-spp-reduction', 'bon-spp-coste',
            'bon-fondos-reduction', 'bon-fondos-minimo', 'bon-notas'
        ].forEach(id => sv(id, ''));
        ['bon-nomina-check', 'bon-vida-check', 'bon-hogar-check', 'bon-tarjeta-check', 'bon-alarma-check', 'bon-spp-check', 'bon-fondos-check'].forEach(id => sc(id, false));
        ['bon-nomina-reduction', 'bon-vida-reduction', 'bon-hogar-reduction', 'bon-tarjeta-reduction', 'bon-alarma-reduction', 'bon-spp-reduction', 'bon-fondos-reduction'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        });
        UI.updateGastosTotal();
    }

    function loadBankIntoForm(b) {
        sv('bank-name', b.name);
        sv('fija-bon-interes', b.fijaBon?.interes); sv('fija-bon-cuota', b.fijaBon?.cuota); sv('fija-bon-total', b.fijaBon?.total);
        sv('fija-nobon-interes', b.fijaNobon?.interes); sv('fija-nobon-cuota', b.fijaNobon?.cuota); sv('fija-nobon-total', b.fijaNobon?.total);
        sv('fija-nobon-amort-0-10', b.fijaNobon?.amort010); sv('fija-nobon-amort-resto', b.fijaNobon?.amortResto);
        sv('gasto-tasacion', b.gastos?.tasacion); sv('gasto-registro', b.gastos?.registro);
        sv('gasto-notaria', b.gastos?.notaria); sv('gasto-gestoria', b.gastos?.gestoria);
        sv('gasto-ajd', b.gastos?.ajd); sv('gasto-apertura', b.gastos?.apertura); sv('gasto-extras', b.gastos?.extras);
        sv('gasto-notas', b.gastos?.notas);
        sc('bon-nomina-check', b.bonificaciones?.nominaActiva); sv('bon-nomina-reduction', b.bonificaciones?.nominaReduction);
        sc('bon-vida-check', b.bonificaciones?.vidaActiva); sv('bon-vida-reduction', b.bonificaciones?.vidaReduction);
        sc('bon-hogar-check', b.bonificaciones?.hogarActiva); sv('bon-hogar-reduction', b.bonificaciones?.hogarReduction);
        sc('bon-tarjeta-check', b.bonificaciones?.tarjetaActiva); sv('bon-tarjeta-reduction', b.bonificaciones?.tarjetaReduction);
        sc('bon-alarma-check', b.bonificaciones?.alarmaActiva); sv('bon-alarma-reduction', b.bonificaciones?.alarmaReduction);
        sc('bon-spp-check', b.bonificaciones?.sppActiva); sv('bon-spp-reduction', b.bonificaciones?.sppReduction);
        sc('bon-fondos-check', b.bonificaciones?.fondosActiva); sv('bon-fondos-reduction', b.bonificaciones?.fondosReduction);
        sv('bon-vida-coste', b.bonificaciones?.vidaCoste);
        sv('bon-hogar-coste', b.bonificaciones?.hogarCoste);
        sv('bon-tarjeta-coste', b.bonificaciones?.tarjetaCoste);
        sv('bon-alarma-coste', b.bonificaciones?.alarmaCoste);
        sv('bon-spp-coste', b.bonificaciones?.sppCoste);
        sv('bon-fondos-minimo', b.bonificaciones?.fondosMinimo);
        sv('bon-notas', b.bonificaciones?.notas);
        ['nomina', 'vida', 'hogar', 'tarjeta', 'alarma', 'spp', 'fondos'].forEach(k => {
            const check = document.getElementById(`bon-${k}-check`);
            const input = document.getElementById(`bon-${k}-reduction`);
            if (check && input) input.disabled = !check.checked;
        });
        UI.updateGastosTotal();
    }

    function collectBankData() {
        return {
            name: gv('bank-name'),
            fijaBon: { interes: gv('fija-bon-interes'), cuota: gv('fija-bon-cuota'), total: gv('fija-bon-total') },
            fijaNobon: {
                interes: gv('fija-nobon-interes'), cuota: gv('fija-nobon-cuota'), total: gv('fija-nobon-total'),
                amort010: gv('fija-nobon-amort-0-10'), amortResto: gv('fija-nobon-amort-resto')
            },
            gastos: {
                tasacion: gv('gasto-tasacion'), registro: gv('gasto-registro'), notaria: gv('gasto-notaria'),
                gestoria: gv('gasto-gestoria'), ajd: gv('gasto-ajd'), apertura: gv('gasto-apertura'), extras: gv('gasto-extras'),
                notas: gv('gasto-notas')
            },
            bonificaciones: {
                nominaActiva: document.getElementById('bon-nomina-check')?.checked,
                vidaActiva: document.getElementById('bon-vida-check')?.checked,
                hogarActiva: document.getElementById('bon-hogar-check')?.checked,
                tarjetaActiva: document.getElementById('bon-tarjeta-check')?.checked,
                alarmaActiva: document.getElementById('bon-alarma-check')?.checked,
                sppActiva: document.getElementById('bon-spp-check')?.checked,
                fondosActiva: document.getElementById('bon-fondos-check')?.checked,
                nominaReduction: gv('bon-nomina-reduction'), vidaReduction: gv('bon-vida-reduction'),
                hogarReduction: gv('bon-hogar-reduction'), tarjetaReduction: gv('bon-tarjeta-reduction'),
                alarmaReduction: gv('bon-alarma-reduction'), sppReduction: gv('bon-spp-reduction'),
                fondosReduction: gv('bon-fondos-reduction'),
                vidaCoste: gv('bon-vida-coste'), hogarCoste: gv('bon-hogar-coste'), tarjetaCoste: gv('bon-tarjeta-coste'),
                alarmaCoste: gv('bon-alarma-coste'), sppCoste: gv('bon-spp-coste'), fondosMinimo: gv('bon-fondos-minimo'),
                notas: gv('bon-notas'),
            },
        };
    }

    // ─── Bonif toggle ────────────────────────────
    function toggleBonif(field) {
        const map = {
            nominaReduction: 'bon-nomina', vidaReduction: 'bon-vida',
            hogarReduction: 'bon-hogar', tarjetaReduction: 'bon-tarjeta',
            alarmaReduction: 'bon-alarma', sppReduction: 'bon-spp',
            fondosReduction: 'bon-fondos'
        };
        const prefix = map[field]; if (!prefix) return;
        const check = document.getElementById(prefix + '-check');
        const input = document.getElementById(prefix + '-reduction');
        if (check && input) input.disabled = !check.checked;
    }

    // ─── CRUD bancos ────────────────────────────
    async function saveBank() {
        const data = collectBankData();
        if (!data.name) {
            UI.showToast('El nombre del banco es obligatorio', 'error');
            switchTab('fija');
            document.getElementById('bank-name').focus();
            return;
        }
        if (state.editingIndex !== null) {
            data.color = state.banks[state.editingIndex].color;
            state.banks[state.editingIndex] = data;
            UI.showToast(`✓ ${data.name} actualizado`, 'success');
        } else {
            data.color = state.banks.length % COLORS;
            state.banks.push(data);
            UI.showToast(`✓ ${data.name} añadido`, 'success');
        }
        closeBankModal();
        await persistAndRefresh();
    }

    async function deleteBank(index) {
        const name = state.banks[index]?.name || 'Banco';
        if (!confirm(`¿Eliminar ${name}?`)) return;
        state.banks.splice(index, 1);
        state.banks.forEach((b, i) => b.color = i % COLORS);
        UI.showToast(`${name} eliminado`);
        await persistAndRefresh();
    }

    async function reorderBanks(fromIndex, toIndex) {
        const moved = state.banks.splice(fromIndex, 1)[0];
        state.banks.splice(toIndex, 0, moved);
        state.banks.forEach((b, i) => b.color = i % COLORS);
        // Remap hiddenBanks after reorder
        const newHidden = new Set();
        state.banks.forEach((_, newIdx) => {
            // not trivially remappable — reset visibility on reorder
        });
        state.hiddenBanks = newHidden;
        await persistAndRefresh();
    }

    function toggleBankVisibility(index) {
        if (state.hiddenBanks.has(index)) {
            state.hiddenBanks.delete(index);
        } else {
            state.hiddenBanks.add(index);
        }
        const visibleBanks = state.banks.filter((_, i) => !state.hiddenBanks.has(i));
        UI.renderBankFilter(state.banks, state.hiddenBanks);
        UI.renderCompareTable(visibleBanks, state.conditions);
        persist(); // guardar en IndexedDB + encolar Gist sync
    }

    // ─── Export / Import JSON ───────────────────
    function exportJSON() {
        const payload = {
            _version: 1, _exportedAt: new Date().toISOString(),
            conditions: state.conditions, banks: state.banks
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bancocomp-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('✓ Exportado como JSON', 'success');
    }

    function importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed.banks || !Array.isArray(parsed.banks)) throw new Error('Formato inválido');
                    state.conditions = parsed.conditions || null;
                    state.banks = parsed.banks;
                    state.banks.forEach((b, i) => b.color = i % COLORS);
                    UI.applyConditionsToUI(state.conditions);
                    await persistAndRefresh();
                    UI.showToast(`✓ ${state.banks.length} banco(s) importados`, 'success');
                } catch (err) {
                    UI.showToast('Error leyendo el archivo JSON', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function resetAll() {
        if (!confirm('¿Borrar todos los datos y empezar de cero?')) return;
        state.conditions = null;
        state.banks = [];
        ['importe', 'valor-inmueble', 'plazo'].forEach(id => sv(id, ''));
        document.getElementById('conditions-summary').style.display = 'none';
        await DB.remove('session');
        refresh();
        if (Gist.isConfigured()) {
            try { await Gist.write({ conditions: null, banks: [] }); } catch (_) { }
        }
        UI.showToast('Datos borrados', 'info');
    }


    // ─── Modal Gist Config ───────────────────────
    function openGistModal() {
        // Pre-fill PAT and Gist ID from memory
        sv('gist-pat', Gist.getToken() || '');
        sv('gist-id', Gist.getGistId() || '');
        updateGistStatus();
        document.getElementById('modal-gist-overlay').classList.add('open');
        document.getElementById('gist-pat').focus();
    }

    function closeGistModal() {
        document.getElementById('modal-gist-overlay').classList.remove('open');
    }

    function closeGistModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-gist-overlay')) closeGistModal();
    }

    function updateGistStatus() {
        const el = document.getElementById('gist-connect-status');
        if (!el) return;
        const token = Gist.getToken();
        const gistId = Gist.getGistId();
        if (token && gistId) {
            el.innerHTML = `<span class="gist-status-ok">✓ Conectado · Gist: <a href="https://gist.github.com/${gistId}" target="_blank" rel="noopener">${gistId.substring(0, 10)}…</a></span>`;
        } else if (token) {
            el.innerHTML = `<span class="gist-status-warn">⚠ Token OK — Conecta o crea un Gist</span>`;
        } else {
            el.innerHTML = `<span class="gist-status-neutral">Sin configurar — introduce tu PAT</span>`;
        }
    }

    async function connectGist() {
        const pat = document.getElementById('gist-pat')?.value.trim();
        const gistId = document.getElementById('gist-id')?.value.trim();
        const btn = document.getElementById('btn-gist-connect');

        if (!pat) { UI.showToast('Introduce tu Personal Access Token', 'error'); return; }

        btn.disabled = true;
        btn.textContent = 'Conectando…';

        try {
            // Validar token
            const username = await Gist.validateToken(pat);
            Gist.setToken(pat);

            if (gistId) {
                // Usar Gist existente → cargar datos
                Gist.setGistId(gistId);
                UI.setSyncStatus('syncing');
                const remoteData = await Gist.read();
                if (remoteData) {
                    state.conditions = remoteData.conditions || null;
                    state.banks = remoteData.banks || [];
                    state.banks.forEach((b, i) => b.color = i % COLORS);
                    UI.applyConditionsToUI(state.conditions);
                    await DB.save('session', { conditions: state.conditions, banks: state.banks });
                    refresh();
                    UI.showToast(`✓ Datos cargados desde Gist (@${username})`, 'success');
                } else {
                    UI.showToast(`✓ Gist conectado — sin datos previos (@${username})`, 'success');
                }
            } else {
                // Crear nuevo Gist
                UI.setSyncStatus('syncing');
                const newId = await Gist.create({ conditions: state.conditions, banks: state.banks });
                Gist.setGistId(newId);
                sv('gist-id', newId);
                UI.showToast(`✓ Nuevo Gist creado (@${username})`, 'success');
            }

            // Guardar config en IndexedDB
            await DB.save('gist-config', { token: pat, gistId: Gist.getGistId() });
            UI.setSyncStatus('synced');
            updateGistStatus();

        } catch (err) {
            UI.showToast(`Error: ${err.message}`, 'error');
            UI.setSyncStatus('error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Conectar';
        }
    }

    async function disconnectGist() {
        if (!confirm('¿Desconectar Gist? Los datos locales se mantendrán.')) return;
        Gist.setToken(null);
        Gist.setGistId(null);
        await DB.remove('gist-config');
        sv('gist-pat', '');
        sv('gist-id', '');
        UI.setSyncStatus('offline');
        updateGistStatus();
        UI.showToast('Gist desconectado — modo local', 'info');
    }

    // ─── INIT ────────────────────────────────────
    async function init() {
        await DB.open();

        // Cargar config de Gist si existe
        const gistConfig = await DB.load('gist-config');
        if (gistConfig?.token) {
            Gist.setToken(gistConfig.token);
            Gist.setGistId(gistConfig.gistId);
        }

        // Cargar datos: Gist (nube) tiene prioridad sobre IndexedDB (local)
        let loaded = false;
        if (Gist.isConfigured()) {
            UI.setSyncStatus('syncing');
            try {
                const remoteData = await Gist.read();
                if (remoteData) {
                    state.conditions = remoteData.conditions || null;
                    state.banks = remoteData.banks || [];
                    state.banks.forEach((b, i) => b.color = i % COLORS);
                    state.hiddenBanks = new Set(remoteData.hiddenBanks || []);
                    await DB.save('session', { conditions: state.conditions, banks: state.banks, hiddenBanks: [...state.hiddenBanks] });
                    loaded = true;
                    UI.setSyncStatus('synced');
                }
            } catch (err) {
                console.warn('No se pudo cargar desde Gist:', err);
                UI.setSyncStatus('error');
            }
        }

        if (!loaded) {
            const saved = await DB.load('session');
            if (saved) {
                state.conditions = saved.conditions || null;
                state.banks = saved.banks || [];
                state.hiddenBanks = new Set(saved.hiddenBanks || []);
            }
            UI.setSyncStatus(Gist.isConfigured() ? 'error' : 'offline');
        }

        // Attach live gastosTotal listeners
        ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd', 'gasto-apertura', 'gasto-extras'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', UI.updateGastosTotal);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeBankModal(); closeGistModal(); }
        });

        // Restore UI
        UI.applyConditionsToUI(state.conditions);
        refresh();

        if (state.banks.length > 0 || state.conditions) {
            UI.showToast('✓ Sesión restaurada', 'success');
        }
    }

    // ─── Public API ───────────────────────────────
    return {
        saveConditions,
        openAddBankModal, openEditBankModal, closeBankModal, closeModalOnOverlay,
        switchTab, toggleBonif,
        saveBank, deleteBank, reorderBanks,
        toggleBankVisibility,
        exportJSON, importJSON, resetAll,
        openGistModal, closeGistModal, closeGistModalOnOverlay,
        connectGist, disconnectGist,
        init,
    };

})();

// Arrancar la app
App.init();
