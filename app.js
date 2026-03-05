/* =============================================
   BANCOCOMP — app.js
   Comparador de hipotecas
   ============================================= */

'use strict';

// ─── State ──────────────────────────────────────
const state = {
    conditions: null,
    banks: [],
    editingIndex: null,
};

const COLORS = 6;

/* =============================================
   INDEXEDDB — Persistencia automática
   ============================================= */
const DB_NAME = 'bancocomp';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const RECORD_KEY = 'main';

let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };

        req.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        req.onerror = (e) => {
            console.error('IndexedDB error:', e.target.error);
            reject(e.target.error);
        };
    });
}

function dbSave() {
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ conditions: state.conditions, banks: state.banks }, RECORD_KEY);
}

function dbLoad() {
    return new Promise((resolve) => {
        if (!db) return resolve(null);
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(RECORD_KEY);
        req.onsuccess = (e) => resolve(e.target.result || null);
        req.onerror = () => resolve(null);
    });
}

// ─── Persist helper — call after any state change ─
function persistAndRender() {
    dbSave();
    renderBanksGrid();
    renderCompareTable();
}

/* =============================================
   FORMAT HELPERS
   ============================================= */
function fmt(val, suffix = '') {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
    return Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
}
function fmtEur(val) { return fmt(val, ' €'); }
function fmtPct(val) { return fmt(val, ' %'); }

/* =============================================
   TOAST
   ============================================= */
function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    setTimeout(() => { el.className = 'toast'; }, 2800);
}

/* =============================================
   CONDITIONS
   ============================================= */
function saveConditions() {
    const importe = parseFloat(document.getElementById('importe').value);
    const inmueble = parseFloat(document.getElementById('valor-inmueble').value);
    const plazo = parseInt(document.getElementById('plazo').value);
    const euribor = parseFloat(document.getElementById('euribor').value);

    if (!importe || !plazo) {
        showToast('Introduce al menos el importe y el plazo', 'error');
        return;
    }

    state.conditions = { importe, inmueble, plazo, euribor };
    applyConditionsToUI();
    showToast('✓ Condiciones guardadas', 'success');
    persistAndRender();
}

function applyConditionsToUI() {
    if (!state.conditions) return;
    const { importe, inmueble, plazo, euribor } = state.conditions;

    const pct = inmueble ? ((importe / inmueble) * 100).toFixed(1) + ' %' : '—';
    document.getElementById('sum-importe').textContent = fmtEur(importe) || '—';
    document.getElementById('sum-inmueble').textContent = fmtEur(inmueble) || '—';
    document.getElementById('sum-financiacion').textContent = pct;
    document.getElementById('sum-plazo').textContent = plazo ? plazo + ' años' : '—';
    document.getElementById('sum-euribor').textContent = euribor ? euribor + ' %' : '—';

    document.getElementById('conditions-summary').style.display = 'flex';

    // Restore form values so the user sees what they entered
    document.getElementById('importe').value = importe || '';
    document.getElementById('valor-inmueble').value = inmueble || '';
    document.getElementById('plazo').value = plazo || '';
    document.getElementById('euribor').value = euribor || '';

    // Update plazo labels in modal
    document.querySelectorAll('[id^="plazo-label-"]').forEach(el => {
        el.textContent = plazo;
    });
}

/* =============================================
   MODAL
   ============================================= */
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

/* =============================================
   FORM HELPERS
   ============================================= */
function getVal(id) {
    const el = document.getElementById(id);
    return el ? (el.value.trim() === '' ? null : el.value.trim()) : null;
}
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== null && val !== undefined ? val : '';
}
function setCheck(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
}

function clearModalForm() {
    const ids = [
        'bank-name',
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
    ];
    ids.forEach(id => setVal(id, ''));
    ['bon-nomina-check', 'bon-vida-check', 'bon-hogar-check', 'bon-tarjeta-check'].forEach(id => setCheck(id, false));
    ['bon-nomina-reduction', 'bon-vida-reduction', 'bon-hogar-reduction', 'bon-tarjeta-reduction'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
    updateGastosTotal();
}

function loadBankIntoForm(b) {
    setVal('bank-name', b.name);
    setVal('fija-bon-interes', b.fijaBon?.interes);
    setVal('fija-bon-cuota', b.fijaBon?.cuota);
    setVal('fija-bon-total', b.fijaBon?.total);
    setVal('fija-nobon-interes', b.fijaNobon?.interes);
    setVal('fija-nobon-cuota', b.fijaNobon?.cuota);
    setVal('fija-nobon-total', b.fijaNobon?.total);
    setVal('fija-nobon-amort-0-10', b.fijaNobon?.amort010);
    setVal('fija-nobon-amort-resto', b.fijaNobon?.amortResto);
    setVal('mixta-bon-total', b.mixtaBon?.total);
    setVal('mixta-bon-anios-fija', b.mixtaBon?.aniosFija);
    setVal('mixta-bon-interes-fija', b.mixtaBon?.interesFija);
    setVal('mixta-bon-cuota-fija', b.mixtaBon?.cuotaFija);
    setVal('mixta-bon-anios-variable', b.mixtaBon?.aniosVar);
    setVal('mixta-bon-interes-variable', b.mixtaBon?.interesVar);
    setVal('mixta-bon-cuota-variable', b.mixtaBon?.cuotaVar);
    setVal('mixta-nobon-total', b.mixtaNobon?.total);
    setVal('mixta-nobon-anios-fija', b.mixtaNobon?.aniosFija);
    setVal('mixta-nobon-interes-fija', b.mixtaNobon?.interesFija);
    setVal('mixta-nobon-cuota-fija', b.mixtaNobon?.cuotaFija);
    setVal('mixta-nobon-anios-variable', b.mixtaNobon?.aniosVar);
    setVal('mixta-nobon-interes-variable', b.mixtaNobon?.interesVar);
    setVal('mixta-nobon-cuota-variable', b.mixtaNobon?.cuotaVar);
    setVal('mixta-nobon-amort-0-10', b.mixtaNobon?.amort010);
    setVal('mixta-nobon-amort-resto', b.mixtaNobon?.amortResto);
    setVal('gasto-tasacion', b.gastos?.tasacion);
    setVal('gasto-registro', b.gastos?.registro);
    setVal('gasto-notaria', b.gastos?.notaria);
    setVal('gasto-gestoria', b.gastos?.gestoria);
    setVal('gasto-ajd', b.gastos?.ajd);
    setCheck('bon-nomina-check', b.bonificaciones?.nominaActiva);
    setCheck('bon-vida-check', b.bonificaciones?.vidaActiva);
    setCheck('bon-hogar-check', b.bonificaciones?.hogarActiva);
    setCheck('bon-tarjeta-check', b.bonificaciones?.tarjetaActiva);
    setVal('bon-nomina-reduction', b.bonificaciones?.nominaReduction);
    setVal('bon-vida-reduction', b.bonificaciones?.vidaReduction);
    setVal('bon-hogar-reduction', b.bonificaciones?.hogarReduction);
    setVal('bon-tarjeta-reduction', b.bonificaciones?.tarjetaReduction);
    setVal('bon-vida-coste', b.bonificaciones?.vidaCoste);
    setVal('bon-hogar-coste', b.bonificaciones?.hogarCoste);
    setVal('bon-tarjeta-coste', b.bonificaciones?.tarjetaCoste);
    ['nomina', 'vida', 'hogar', 'tarjeta'].forEach(k => {
        const check = document.getElementById(`bon-${k}-check`);
        const input = document.getElementById(`bon-${k}-reduction`);
        if (check && input) input.disabled = !check.checked;
    });
    updateGastosTotal();
}

function collectBankData() {
    return {
        name: getVal('bank-name'),
        fijaBon: {
            interes: getVal('fija-bon-interes'),
            cuota: getVal('fija-bon-cuota'),
            total: getVal('fija-bon-total'),
        },
        fijaNobon: {
            interes: getVal('fija-nobon-interes'),
            cuota: getVal('fija-nobon-cuota'),
            total: getVal('fija-nobon-total'),
            amort010: getVal('fija-nobon-amort-0-10'),
            amortResto: getVal('fija-nobon-amort-resto'),
        },
        mixtaBon: {
            total: getVal('mixta-bon-total'),
            aniosFija: getVal('mixta-bon-anios-fija'),
            interesFija: getVal('mixta-bon-interes-fija'),
            cuotaFija: getVal('mixta-bon-cuota-fija'),
            aniosVar: getVal('mixta-bon-anios-variable'),
            interesVar: getVal('mixta-bon-interes-variable'),
            cuotaVar: getVal('mixta-bon-cuota-variable'),
        },
        mixtaNobon: {
            total: getVal('mixta-nobon-total'),
            aniosFija: getVal('mixta-nobon-anios-fija'),
            interesFija: getVal('mixta-nobon-interes-fija'),
            cuotaFija: getVal('mixta-nobon-cuota-fija'),
            aniosVar: getVal('mixta-nobon-anios-variable'),
            interesVar: getVal('mixta-nobon-interes-variable'),
            cuotaVar: getVal('mixta-nobon-cuota-variable'),
            amort010: getVal('mixta-nobon-amort-0-10'),
            amortResto: getVal('mixta-nobon-amort-resto'),
        },
        gastos: {
            tasacion: getVal('gasto-tasacion'),
            registro: getVal('gasto-registro'),
            notaria: getVal('gasto-notaria'),
            gestoria: getVal('gasto-gestoria'),
            ajd: getVal('gasto-ajd'),
        },
        bonificaciones: {
            nominaActiva: document.getElementById('bon-nomina-check')?.checked,
            vidaActiva: document.getElementById('bon-vida-check')?.checked,
            hogarActiva: document.getElementById('bon-hogar-check')?.checked,
            tarjetaActiva: document.getElementById('bon-tarjeta-check')?.checked,
            nominaReduction: getVal('bon-nomina-reduction'),
            vidaReduction: getVal('bon-vida-reduction'),
            hogarReduction: getVal('bon-hogar-reduction'),
            tarjetaReduction: getVal('bon-tarjeta-reduction'),
            vidaCoste: getVal('bon-vida-coste'),
            hogarCoste: getVal('bon-hogar-coste'),
            tarjetaCoste: getVal('bon-tarjeta-coste'),
        },
    };
}

/* =============================================
   BONIF TOGGLE
   ============================================= */
function toggleBonif(field) {
    const map = {
        nominaReduction: 'bon-nomina',
        vidaReduction: 'bon-vida',
        hogarReduction: 'bon-hogar',
        tarjetaReduction: 'bon-tarjeta',
    };
    const prefix = map[field];
    if (!prefix) return;
    const check = document.getElementById(prefix + '-check');
    const input = document.getElementById(prefix + '-reduction');
    if (check && input) input.disabled = !check.checked;
}

/* =============================================
   GASTOS TOTAL LIVE
   ============================================= */
function updateGastosTotal() {
    const ids = ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd'];
    const total = ids.reduce((s, id) => s + (parseFloat(document.getElementById(id)?.value) || 0), 0);
    const el = document.getElementById('total-gastos-val');
    if (el) el.textContent = total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* =============================================
   SAVE BANK
   ============================================= */
function saveBank() {
    const data = collectBankData();
    if (!data.name) {
        showToast('El nombre del banco es obligatorio', 'error');
        switchTab('fija');
        document.getElementById('bank-name').focus();
        return;
    }

    if (state.editingIndex !== null) {
        data.color = state.banks[state.editingIndex].color;
        state.banks[state.editingIndex] = data;
        showToast(`✓ ${data.name} actualizado`, 'success');
    } else {
        data.color = state.banks.length % COLORS;
        state.banks.push(data);
        showToast(`✓ ${data.name} añadido`, 'success');
    }

    closeBankModal();
    persistAndRender();
}

/* =============================================
   DELETE BANK
   ============================================= */
function deleteBank(index) {
    const name = state.banks[index]?.name || 'Banco';
    if (!confirm(`¿Eliminar ${name}?`)) return;
    state.banks.splice(index, 1);
    state.banks.forEach((b, i) => b.color = i % COLORS);
    showToast(`${name} eliminado`);
    persistAndRender();
}

/* =============================================
   EXPORT / IMPORT JSON
   ============================================= */
function exportJSON() {
    const payload = {
        _version: 1,
        _exportedAt: new Date().toISOString(),
        conditions: state.conditions,
        banks: state.banks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bancocomp-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Datos exportados como JSON', 'success');
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed.banks || !Array.isArray(parsed.banks)) throw new Error('Formato inválido');
                state.conditions = parsed.conditions || null;
                state.banks = parsed.banks;
                // recalc colors
                state.banks.forEach((b, i) => b.color = i % COLORS);
                applyConditionsToUI();
                persistAndRender();
                showToast(`✓ ${state.banks.length} banco(s) importados`, 'success');
            } catch (err) {
                showToast('Error al leer el archivo JSON', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetAll() {
    if (!confirm('¿Borrar todos los datos y empezar de cero?')) return;
    state.conditions = null;
    state.banks = [];
    // clear form
    ['importe', 'valor-inmueble', 'plazo', 'euribor'].forEach(id => setVal(id, ''));
    document.getElementById('conditions-summary').style.display = 'none';
    if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    }
    renderBanksGrid();
    renderCompareTable();
    showToast('Datos borrados', 'info');
}

/* =============================================
   RENDER: BANKS GRID
   ============================================= */
function renderBanksGrid() {
    const grid = document.getElementById('banks-grid');
    const empty = document.getElementById('empty-state');

    if (state.banks.length === 0) {
        grid.innerHTML = '';
        grid.appendChild(empty);
        return;
    }

    grid.innerHTML = state.banks.map((b, i) => {
        const initials = b.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const totalFijaBon = b.fijaBon?.total ? fmtEur(b.fijaBon.total) : null;
        const cuotaFijaBon = b.fijaBon?.cuota ? fmtEur(b.fijaBon.cuota) : null;
        const interesFijaBon = b.fijaBon?.interes ? fmtPct(b.fijaBon.interes) : null;

        const gastos = b.gastos;
        const totalGastos = gastos
            ? [gastos.tasacion, gastos.registro, gastos.notaria, gastos.gestoria, gastos.ajd]
                .reduce((s, v) => s + (parseFloat(v) || 0), 0)
            : 0;

        const bonActivas = [];
        if (b.bonificaciones?.nominaActiva) bonActivas.push('Nómina');
        if (b.bonificaciones?.vidaActiva) bonActivas.push('Seg. Vida');
        if (b.bonificaciones?.hogarActiva) bonActivas.push('Seg. Hogar');
        if (b.bonificaciones?.tarjetaActiva) bonActivas.push('Tarjeta');

        return `
      <div class="bank-card" data-color="${b.color}">
        <div class="bank-card-header">
          <div class="bank-avatar" data-color="${b.color}">${initials}</div>
          <span class="bank-name">${escapeHtml(b.name)}</span>
          <div class="bank-actions">
            <button class="btn-icon" onclick="openEditBankModal(${i})" title="Editar" aria-label="Editar ${escapeHtml(b.name)}">
              <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4C3.47 4 2.96 4.21 2.59 4.59C2.21 4.96 2 5.47 2 6V20C2 20.53 2.21 21.04 2.59 21.41C2.96 21.79 3.47 22 4 22H18C18.53 22 19.04 21.79 19.41 21.41C19.79 21.04 20 20.53 20 20V13M18.5 2.5C18.9 2.1 19.44 1.88 20 1.88C20.56 1.88 21.1 2.1 21.5 2.5C21.9 2.9 22.12 3.44 22.12 4C22.12 4.56 21.9 5.1 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn-icon btn-danger" onclick="deleteBank(${i})" title="Eliminar" aria-label="Eliminar ${escapeHtml(b.name)}">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 6H5H21M8 6V4C8 3.47 8.21 2.96 8.59 2.59C8.96 2.21 9.47 2 10 2H14C14.53 2 15.04 2.21 15.41 2.59C15.79 2.96 16 3.47 16 4V6M19 6V20C19 20.53 18.79 21.04 18.41 21.41C18.04 21.79 17.53 22 17 22H7C6.47 22 5.96 21.79 5.59 21.41C5.21 21.04 5 20.53 5 20V6H19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div class="bank-metrics">
          <div class="bank-metric">
            <div class="bank-metric-label">Fija bon. interés</div>
            <div class="bank-metric-value highlight">${interesFijaBon || '—'}</div>
          </div>
          <div class="bank-metric">
            <div class="bank-metric-label">Cuota fija bon.</div>
            <div class="bank-metric-value">${cuotaFijaBon || '—'}</div>
          </div>
          <div class="bank-metric">
            <div class="bank-metric-label">Total fija bon.</div>
            <div class="bank-metric-value">${totalFijaBon || '—'}</div>
          </div>
          <div class="bank-metric">
            <div class="bank-metric-label">Otros gastos</div>
            <div class="bank-metric-value">${totalGastos > 0 ? fmtEur(totalGastos) : '—'}</div>
          </div>
        </div>
        <div class="bank-tags">
          ${bonActivas.map(t => `<span class="bank-tag tag-blue">${t}</span>`).join('')}
          ${b.fijaBon?.interes ? '<span class="bank-tag tag-green">Hipoteca fija</span>' : ''}
          ${b.mixtaBon?.total ? '<span class="bank-tag tag-purple">Hipoteca mixta</span>' : ''}
        </div>
      </div>
    `;
    }).join('');
}

/* =============================================
   RENDER: COMPARE TABLE
   ============================================= */
function renderCompareTable() {
    const section = document.getElementById('section-compare');
    const wrapper = document.getElementById('compare-wrapper');

    if (state.banks.length < 1) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const banks = state.banks;
    const plazo = state.conditions?.plazo || '—';

    function bestMin(getter) {
        const vals = banks.map(b => parseFloat(getter(b)));
        const valid = vals.filter(v => !isNaN(v));
        if (valid.length < 2) return -1;
        return vals.findIndex(v => v === Math.min(...valid));
    }
    function worstMax(getter) {
        const vals = banks.map(b => parseFloat(getter(b)));
        const valid = vals.filter(v => !isNaN(v));
        if (valid.length < 2) return -1;
        return vals.findIndex(v => v === Math.max(...valid));
    }

    function row(label, getter, fmtFn, bestFn, worstFn) {
        const cells = banks.map((b, i) => {
            const raw = getter(b);
            const val = raw !== null && raw !== undefined && raw !== '' ? raw : null;
            let cls = '';
            if (val !== null) {
                const bIdx = bestFn ? bestFn(getter) : -1;
                const wIdx = worstFn ? worstFn(getter) : -1;
                if (bIdx === i) cls = 'best';
                else if (wIdx === i) cls = 'worst';
            }
            return `<td class="${cls}">${val !== null ? (fmtFn ? fmtFn(val) : val) : '<span class="no-val">—</span>'}</td>`;
        }).join('');
        return `<tr><td>${label}</td>${cells}</tr>`;
    }

    function sectionRow(label, cls = '') {
        return `<tr class="section-row ${cls}"><td colspan="${banks.length + 1}">${label}</td></tr>`;
    }

    function totalGastos(b) {
        const g = b.gastos; if (!g) return null;
        const t = [g.tasacion, g.registro, g.notaria, g.gestoria, g.ajd]
            .reduce((s, v) => s + (parseFloat(v) || 0), 0);
        return t > 0 ? t : null;
    }

    const headers = banks.map(b =>
        `<th data-color="${b.color}">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${colorForIndex(b.color)};"></span>
        ${escapeHtml(b.name)}
      </div>
    </th>`
    ).join('');

    wrapper.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr><th>Campo</th>${headers}</tr>
      </thead>
      <tbody>
        ${sectionRow(`🏠 Hipoteca Fija — ${plazo} años — BONIFICADA`, 'green')}
        ${row('% Interés', b => b.fijaBon?.interes, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual', b => b.fijaBon?.cuota, fmtEur, bestMin, worstMax)}
        ${row('Total a pagar', b => b.fijaBon?.total, fmtEur, bestMin, worstMax)}

        ${sectionRow(`🏠 Hipoteca Fija — ${plazo} años — NO BONIFICADA`, 'orange')}
        ${row('% Interés', b => b.fijaNobon?.interes, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual', b => b.fijaNobon?.cuota, fmtEur, bestMin, worstMax)}
        ${row('Total a pagar', b => b.fijaNobon?.total, fmtEur, bestMin, worstMax)}
        ${row('Amortización 0-10 años', b => b.fijaNobon?.amort010, fmtPct, bestMin, worstMax)}
        ${row('Amortización resto', b => b.fijaNobon?.amortResto, fmtPct, bestMin, worstMax)}

        ${sectionRow(`🔄 Hipoteca Mixta — ${plazo} años — BONIFICADA`, 'green')}
        ${row('Total a pagar', b => b.mixtaBon?.total, fmtEur, bestMin, worstMax)}
        ${row('Años tramo fijo', b => b.mixtaBon?.aniosFija, v => v + ' años', null, null)}
        ${row('% Interés fija', b => b.mixtaBon?.interesFija, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual fija', b => b.mixtaBon?.cuotaFija, fmtEur, bestMin, worstMax)}
        ${row('Años tramo variable', b => b.mixtaBon?.aniosVar, v => v + ' años', null, null)}
        ${row('% Interés variable', b => b.mixtaBon?.interesVar, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual variable', b => b.mixtaBon?.cuotaVar, fmtEur, bestMin, worstMax)}

        ${sectionRow(`🔄 Hipoteca Mixta — ${plazo} años — NO BONIFICADA`, 'orange')}
        ${row('Total a pagar', b => b.mixtaNobon?.total, fmtEur, bestMin, worstMax)}
        ${row('Años tramo fijo', b => b.mixtaNobon?.aniosFija, v => v + ' años', null, null)}
        ${row('% Interés fija', b => b.mixtaNobon?.interesFija, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual fija', b => b.mixtaNobon?.cuotaFija, fmtEur, bestMin, worstMax)}
        ${row('Años tramo variable', b => b.mixtaNobon?.aniosVar, v => v + ' años', null, null)}
        ${row('% Interés variable', b => b.mixtaNobon?.interesVar, fmtPct, bestMin, worstMax)}
        ${row('Cuota mensual variable', b => b.mixtaNobon?.cuotaVar, fmtEur, bestMin, worstMax)}
        ${row('Amortización 0-10 años', b => b.mixtaNobon?.amort010, fmtPct, bestMin, worstMax)}
        ${row('Amortización resto', b => b.mixtaNobon?.amortResto, fmtPct, bestMin, worstMax)}

        ${sectionRow('💸 Otros Gastos', '')}
        ${row('Tasación', b => b.gastos?.tasacion, fmtEur, bestMin, worstMax)}
        ${row('Registro propiedad', b => b.gastos?.registro, fmtEur, bestMin, worstMax)}
        ${row('Notaría', b => b.gastos?.notaria, fmtEur, bestMin, worstMax)}
        ${row('Gestoría', b => b.gastos?.gestoria, fmtEur, bestMin, worstMax)}
        ${row('Impuesto AJD', b => b.gastos?.ajd, fmtEur, bestMin, worstMax)}
        ${row('TOTAL otros gastos', totalGastos, fmtEur, bestMin, worstMax)}

        ${sectionRow('⭐ Bonificaciones', 'purple')}
        ${row('Domiciliar nómina', b => b.bonificaciones?.nominaActiva ? (b.bonificaciones.nominaReduction ? '-' + b.bonificaciones.nominaReduction + ' %' : 'Sí') : null, v => v, null, null)}
        ${row('Seguro de vida', b => b.bonificaciones?.vidaActiva ? (b.bonificaciones.vidaReduction ? '-' + b.bonificaciones.vidaReduction + ' %' : 'Sí') : null, v => v, null, null)}
        ${row('Coste seg. vida (€/año)', b => b.bonificaciones?.vidaActiva ? b.bonificaciones.vidaCoste : null, fmtEur, bestMin, worstMax)}
        ${row('Seguro de hogar', b => b.bonificaciones?.hogarActiva ? (b.bonificaciones.hogarReduction ? '-' + b.bonificaciones.hogarReduction + ' %' : 'Sí') : null, v => v, null, null)}
        ${row('Coste seg. hogar (€/año)', b => b.bonificaciones?.hogarActiva ? b.bonificaciones.hogarCoste : null, fmtEur, bestMin, worstMax)}
        ${row('Tarjeta de crédito', b => b.bonificaciones?.tarjetaActiva ? (b.bonificaciones.tarjetaReduction ? '-' + b.bonificaciones.tarjetaReduction + ' %' : 'Sí') : null, v => v, null, null)}
        ${row('Coste tarjeta (€/año)', b => b.bonificaciones?.tarjetaActiva ? b.bonificaciones.tarjetaCoste : null, fmtEur, bestMin, worstMax)}
      </tbody>
    </table>
  `;
}

function colorForIndex(idx) {
    const colors = [
        'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        'linear-gradient(135deg, #10b981, #06b6d4)',
        'linear-gradient(135deg, #f59e0b, #ef4444)',
        'linear-gradient(135deg, #ec4899, #8b5cf6)',
        'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'linear-gradient(135deg, #84cc16, #10b981)',
    ];
    return colors[idx % colors.length];
}

/* =============================================
   UTILS
   ============================================= */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* =============================================
   KEYBOARD SHORTCUTS
   ============================================= */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeBankModal();
});

/* =============================================
   INIT — Open DB → Load data → Render
   ============================================= */
openDB().then(async () => {
    const saved = await dbLoad();
    if (saved) {
        if (saved.conditions) state.conditions = saved.conditions;
        if (saved.banks) state.banks = saved.banks;
    }

    // Attach live gastos listeners
    ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateGastosTotal);
    });

    // Restore UI
    applyConditionsToUI();
    renderBanksGrid();
    renderCompareTable();

    if (saved && (saved.banks?.length > 0 || saved.conditions)) {
        showToast('✓ Sesión restaurada', 'success');
    }
}).catch(err => {
    console.warn('IndexedDB no disponible, sin persistencia:', err);
    // Graceful fallback: app funciona sin guardar
    ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateGastosTotal);
    });
    renderBanksGrid();
});
