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
    };

    // ─── Persistencia: guarda local + Gist ─────
    async function persist() {
        const data = { conditions: state.conditions, banks: state.banks };
        // 1. Siempre guardar en IndexedDB (local, inmediato)
        await DB.save('session', data);
        // 2. Si hay Gist configurado, sincronizar en la nube
        if (Gist.isConfigured()) {
            UI.setSyncStatus('syncing');
            try {
                await Gist.write(data);
                UI.setSyncStatus('synced');
            } catch (err) {
                console.error('Gist sync error:', err);
                UI.setSyncStatus('error');
                UI.showToast(`⚠️ Error al sincronizar: ${err.message}`, 'error');
            }
        }
    }

    function refresh() {
        UI.renderBanksGrid(state.banks);
        UI.renderCompareTable(state.banks, state.conditions);
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
        const euribor = parseFloat(document.getElementById('euribor').value);
        if (!importe || !plazo) {
            UI.showToast('Introduce al menos el importe y el plazo', 'error');
            return;
        }
        state.conditions = { importe, inmueble, plazo, euribor };
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
            'mixta-bon-total', 'mixta-bon-anios-fija', 'mixta-bon-interes-fija', 'mixta-bon-cuota-fija',
            'mixta-bon-anios-variable', 'mixta-bon-interes-variable', 'mixta-bon-cuota-variable',
            'mixta-nobon-total', 'mixta-nobon-anios-fija', 'mixta-nobon-interes-fija', 'mixta-nobon-cuota-fija',
            'mixta-nobon-anios-variable', 'mixta-nobon-interes-variable', 'mixta-nobon-cuota-variable',
            'mixta-nobon-amort-0-10', 'mixta-nobon-amort-resto',
            'gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd',
            'bon-nomina-reduction', 'bon-vida-reduction', 'bon-hogar-reduction', 'bon-tarjeta-reduction',
            'bon-vida-coste', 'bon-hogar-coste', 'bon-tarjeta-coste',
        ].forEach(id => sv(id, ''));
        ['bon-nomina-check', 'bon-vida-check', 'bon-hogar-check', 'bon-tarjeta-check'].forEach(id => sc(id, false));
        ['bon-nomina-reduction', 'bon-vida-reduction', 'bon-hogar-reduction', 'bon-tarjeta-reduction'].forEach(id => {
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
        sv('mixta-bon-total', b.mixtaBon?.total); sv('mixta-bon-anios-fija', b.mixtaBon?.aniosFija);
        sv('mixta-bon-interes-fija', b.mixtaBon?.interesFija); sv('mixta-bon-cuota-fija', b.mixtaBon?.cuotaFija);
        sv('mixta-bon-anios-variable', b.mixtaBon?.aniosVar); sv('mixta-bon-interes-variable', b.mixtaBon?.interesVar);
        sv('mixta-bon-cuota-variable', b.mixtaBon?.cuotaVar);
        sv('mixta-nobon-total', b.mixtaNobon?.total); sv('mixta-nobon-anios-fija', b.mixtaNobon?.aniosFija);
        sv('mixta-nobon-interes-fija', b.mixtaNobon?.interesFija); sv('mixta-nobon-cuota-fija', b.mixtaNobon?.cuotaFija);
        sv('mixta-nobon-anios-variable', b.mixtaNobon?.aniosVar); sv('mixta-nobon-interes-variable', b.mixtaNobon?.interesVar);
        sv('mixta-nobon-cuota-variable', b.mixtaNobon?.cuotaVar); sv('mixta-nobon-amort-0-10', b.mixtaNobon?.amort010);
        sv('mixta-nobon-amort-resto', b.mixtaNobon?.amortResto);
        sv('gasto-tasacion', b.gastos?.tasacion); sv('gasto-registro', b.gastos?.registro);
        sv('gasto-notaria', b.gastos?.notaria); sv('gasto-gestoria', b.gastos?.gestoria); sv('gasto-ajd', b.gastos?.ajd);
        sc('bon-nomina-check', b.bonificaciones?.nominaActiva); sv('bon-nomina-reduction', b.bonificaciones?.nominaReduction);
        sc('bon-vida-check', b.bonificaciones?.vidaActiva); sv('bon-vida-reduction', b.bonificaciones?.vidaReduction);
        sc('bon-hogar-check', b.bonificaciones?.hogarActiva); sv('bon-hogar-reduction', b.bonificaciones?.hogarReduction);
        sc('bon-tarjeta-check', b.bonificaciones?.tarjetaActiva); sv('bon-tarjeta-reduction', b.bonificaciones?.tarjetaReduction);
        sv('bon-vida-coste', b.bonificaciones?.vidaCoste);
        sv('bon-hogar-coste', b.bonificaciones?.hogarCoste);
        sv('bon-tarjeta-coste', b.bonificaciones?.tarjetaCoste);
        ['nomina', 'vida', 'hogar', 'tarjeta'].forEach(k => {
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
            mixtaBon: {
                total: gv('mixta-bon-total'), aniosFija: gv('mixta-bon-anios-fija'), interesFija: gv('mixta-bon-interes-fija'),
                cuotaFija: gv('mixta-bon-cuota-fija'), aniosVar: gv('mixta-bon-anios-variable'),
                interesVar: gv('mixta-bon-interes-variable'), cuotaVar: gv('mixta-bon-cuota-variable')
            },
            mixtaNobon: {
                total: gv('mixta-nobon-total'), aniosFija: gv('mixta-nobon-anios-fija'), interesFija: gv('mixta-nobon-interes-fija'),
                cuotaFija: gv('mixta-nobon-cuota-fija'), aniosVar: gv('mixta-nobon-anios-variable'),
                interesVar: gv('mixta-nobon-interes-variable'), cuotaVar: gv('mixta-nobon-cuota-variable'),
                amort010: gv('mixta-nobon-amort-0-10'), amortResto: gv('mixta-nobon-amort-resto')
            },
            gastos: {
                tasacion: gv('gasto-tasacion'), registro: gv('gasto-registro'), notaria: gv('gasto-notaria'),
                gestoria: gv('gasto-gestoria'), ajd: gv('gasto-ajd')
            },
            bonificaciones: {
                nominaActiva: document.getElementById('bon-nomina-check')?.checked,
                vidaActiva: document.getElementById('bon-vida-check')?.checked,
                hogarActiva: document.getElementById('bon-hogar-check')?.checked,
                tarjetaActiva: document.getElementById('bon-tarjeta-check')?.checked,
                nominaReduction: gv('bon-nomina-reduction'), vidaReduction: gv('bon-vida-reduction'),
                hogarReduction: gv('bon-hogar-reduction'), tarjetaReduction: gv('bon-tarjeta-reduction'),
                vidaCoste: gv('bon-vida-coste'), hogarCoste: gv('bon-hogar-coste'), tarjetaCoste: gv('bon-tarjeta-coste'),
            },
        };
    }

    // ─── Bonif toggle ────────────────────────────
    function toggleBonif(field) {
        const map = { nominaReduction: 'bon-nomina', vidaReduction: 'bon-vida', hogarReduction: 'bon-hogar', tarjetaReduction: 'bon-tarjeta' };
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
        ['importe', 'valor-inmueble', 'plazo', 'euribor'].forEach(id => sv(id, ''));
        document.getElementById('conditions-summary').style.display = 'none';
        await DB.remove('session');
        refresh();
        if (Gist.isConfigured()) {
            try { await Gist.write({ conditions: null, banks: [] }); } catch (_) { }
        }
        UI.showToast('Datos borrados', 'info');
    }

    // ─── Euríbor BCE ───────────────────────────
    async function fetchEuribor() {
        const btn = document.getElementById('btn-euribor');
        const input = document.getElementById('euribor');
        const badge = document.getElementById('euribor-badge');

        if (btn) { btn.disabled = true; btn.classList.add('loading'); }
        if (badge) { badge.textContent = 'Consultando BCE…'; badge.className = 'euribor-badge'; }

        try {
            const data = await Euribor.fetch('12m');
            if (!data) throw new Error('Sin datos');
            if (input) {
                input.disabled = false;
                input.value = data.value;
                input.disabled = true;
            }
            if (badge) {
                badge.textContent = `Euríbor 12 meses: ${data.value} % · Dato de ${data.period} · Fuente: BCE`;
                badge.className = 'euribor-badge euribor-badge--ok';
            }
            UI.showToast(`✓ Euríbor 12 meses: ${data.value} %`, 'success');
        } catch (err) {
            if (badge) {
                badge.textContent = 'No se pudo obtener el dato del BCE';
                badge.className = 'euribor-badge euribor-badge--error';
            }
            UI.showToast('Error al obtener Euríbor del BCE', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
        }
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
                    await DB.save('session', { conditions: state.conditions, banks: state.banks });
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
            }
            UI.setSyncStatus(Gist.isConfigured() ? 'error' : 'offline');
        }

        // Attach live gastosTotal listeners
        ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', UI.updateGastosTotal);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeBankModal(); closeGistModal(); }
        });

        // Auto-fetch Euríbor al arrancar (con caché de 6h)
        Euribor.load().then(data => {
            if (data?.['12m']) {
                const input = document.getElementById('euribor');
                const badge = document.getElementById('euribor-badge');
                if (input && !input.value) {
                    input.value = data['12m'].value;
                    if (badge) {
                        badge.textContent = `Euríbor 12 meses: ${data['12m'].value} % · Dato de ${data['12m'].period} · Fuente: BCE`;
                        badge.className = 'euribor-badge euribor-badge--ok';
                    }
                }
            }
        }).catch(() => { });

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
        saveBank, deleteBank,
        exportJSON, importJSON, resetAll,
        openGistModal, closeGistModal, closeGistModalOnOverlay,
        connectGist, disconnectGist,
        fetchEuribor,
        init,
    };

})();

// Arrancar la app
App.init();
