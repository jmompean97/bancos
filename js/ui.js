/* =============================================
   js/ui.js — Capa de presentación
   Todo el renderizado dinámico de la app:
   tarjetas de banco, tabla comparativa, formularios.
   ============================================= */

'use strict';

const UI = (() => {

  const COLORS = 6;
  let _stickyCleanup = null; // cleanup fn for sticky header

  // ─── Format helpers ────────────────────────
  function fmt(val, suffix = '') {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
    return Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
  }
  function fmtEur(val) { return fmt(val, ' €'); }
  function fmtPct(val) { return fmt(val, ' %'); }

  function colorGradient(idx) {
    const colors = [
      'linear-gradient(135deg,#3b82f6,#8b5cf6)',
      'linear-gradient(135deg,#10b981,#06b6d4)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#ec4899,#8b5cf6)',
      'linear-gradient(135deg,#06b6d4,#3b82f6)',
      'linear-gradient(135deg,#84cc16,#10b981)',
    ];
    return colors[idx % colors.length];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Toast ─────────────────────────────────
  function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  // ─── Sync status indicator ──────────────────
  function setSyncStatus(status) {
    // status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
    const el = document.getElementById('sync-status');
    if (!el) return;
    const labels = {
      idle: { icon: '⚪', text: 'Local', cls: 'sync-idle' },
      syncing: { icon: '🔄', text: 'Sincronizando…', cls: 'sync-syncing' },
      synced: { icon: '🟢', text: 'Sincronizado', cls: 'sync-synced' },
      error: { icon: '🔴', text: 'Error sync', cls: 'sync-error' },
      offline: { icon: '🟡', text: 'Sin Gist', cls: 'sync-offline' },
    };
    const s = labels[status] || labels.idle;
    el.className = `sync-status ${s.cls}`;
    el.innerHTML = `<span class="sync-icon">${s.icon}</span><span class="sync-text">${s.text}</span>`;
  }

  // ─── Conditions summary ─────────────────────
  function applyConditionsToUI(conditions) {
    if (!conditions) return;
    const { importe, inmueble, plazo } = conditions;
    const pct = inmueble ? ((importe / inmueble) * 100).toFixed(1) + ' %' : '—';
    const $ = (id) => document.getElementById(id);
    $('sum-importe').textContent = fmtEur(importe) || '—';
    $('sum-inmueble').textContent = fmtEur(inmueble) || '—';
    $('sum-financiacion').textContent = pct;
    $('sum-plazo').textContent = plazo ? plazo + ' años' : '—';

    $('conditions-summary').style.display = 'flex';
    $('importe').value = importe || '';
    $('valor-inmueble').value = inmueble || '';
    $('plazo').value = plazo || '';

    document.querySelectorAll('[id^="plazo-label-"]').forEach(el => {
      el.textContent = plazo;
    });
  }

  // ─── Gastos total live ──────────────────────
  function updateGastosTotal() {
    const ids = ['gasto-tasacion', 'gasto-registro', 'gasto-notaria', 'gasto-gestoria', 'gasto-ajd', 'gasto-apertura', 'gasto-extras'];
    const total = ids.reduce((s, id) => s + (parseFloat(document.getElementById(id)?.value) || 0), 0);
    const el = document.getElementById('total-gastos-val');
    if (el) el.textContent = total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  // ─── Banks Grid ─────────────────────────────
  function renderBanksGrid(banks, onEdit, onDelete) {
    const grid = document.getElementById('banks-grid');
    const empty = document.getElementById('empty-state');

    if (!banks || banks.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(empty);
      return;
    }

    grid.innerHTML = banks.map((b, i) => {
      const initials = b.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const interesFijaBon = b.fijaBon?.interes ? fmtPct(b.fijaBon.interes) : null;
      const cuotaFijaBon = b.fijaBon?.cuota ? fmtEur(b.fijaBon.cuota) : null;
      const totalFijaBon = b.fijaBon?.total ? fmtEur(b.fijaBon.total) : null;
      const gastos = b.gastos;
      const totalGastos = gastos
        ? [gastos.tasacion, gastos.registro, gastos.notaria, gastos.gestoria, gastos.ajd, gastos.apertura, gastos.extras]
          .reduce((s, v) => s + (parseFloat(v) || 0), 0)
        : 0;
      const bonActivas = [];
      if (b.bonificaciones?.nominaActiva) bonActivas.push('Nómina');
      if (b.bonificaciones?.vidaActiva) bonActivas.push('Seg. Vida');
      if (b.bonificaciones?.hogarActiva) bonActivas.push('Seg. Hogar');
      if (b.bonificaciones?.tarjetaActiva) bonActivas.push('Tarjeta');
      if (b.bonificaciones?.alarmaActiva) bonActivas.push('Alarma');
      if (b.bonificaciones?.sppActiva) bonActivas.push('Prot. Pagos');
      if (b.bonificaciones?.fondosActiva) bonActivas.push('F. Inversión');

      return `
        <div class="bank-card" data-color="${b.color}" data-index="${i}" draggable="true">
          <div class="bank-card-header">
            <div class="drag-handle" title="Arrastrar para reordenar" aria-label="Mover banco">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="5" r="1.2" fill="currentColor"/><circle cx="15" cy="5" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="19" r="1.2" fill="currentColor"/><circle cx="15" cy="19" r="1.2" fill="currentColor"/></svg>
            </div>
            <div class="bank-avatar" data-color="${b.color}">${initials}</div>
            <span class="bank-name">${escapeHtml(b.name)}</span>
            <div class="bank-actions">
              <button class="btn-icon" onclick="App.openEditBankModal(${i})" title="Editar" aria-label="Editar ${escapeHtml(b.name)}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4C3.47 4 2.96 4.21 2.59 4.59 2.21 4.96 2 5.47 2 6V20C2 20.53 2.21 21.04 2.59 21.41 2.96 21.79 3.47 22 4 22H18C18.53 22 19.04 21.79 19.41 21.41 19.79 21.04 20 20.53 20 20V13M18.5 2.5C18.9 2.1 19.44 1.88 20 1.88 20.56 1.88 21.1 2.1 21.5 2.5 21.9 2.9 22.12 3.44 22.12 4 22.12 4.56 21.9 5.1 21.5 5.5L12 15L8 16 9 12 18.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn-icon btn-danger" onclick="App.deleteBank(${i})" title="Eliminar" aria-label="Eliminar ${escapeHtml(b.name)}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M3 6H5H21M8 6V4C8 3.47 8.21 2.96 8.59 2.59 8.96 2.21 9.47 2 10 2H14C14.53 2 15.04 2.21 15.41 2.59 15.79 2.96 16 3.47 16 4V6M19 6V20C19 20.53 18.79 21.04 18.41 21.41 18.04 21.79 17.53 22 17 22H7C6.47 22 5.96 21.79 5.59 21.41 5.21 21.04 5 20.53 5 20V6H19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
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
          </div>
        </div>`;
    }).join('');

    // ─── Drag & Drop: inicializar solo una vez ─
    if (!grid._dndReady) {
      _initDragAndDrop(grid);
      grid._dndReady = true;
    }
  }

  function _initDragAndDrop(grid) {
    let dragSrcIndex = null;
    let dragOverIndex = null;

    function getCard(el) {
      return el.closest('.bank-card');
    }

    grid.addEventListener('dragstart', e => {
      const card = getCard(e.target);
      if (!card) return;
      dragSrcIndex = parseInt(card.dataset.index, 10);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcIndex);
    });

    grid.addEventListener('dragend', () => {
      grid.querySelectorAll('.bank-card').forEach(c => {
        c.classList.remove('dragging', 'drag-over');
      });
      dragSrcIndex = null;
      dragOverIndex = null;
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const card = getCard(e.target);
      if (!card) return;
      const newOver = parseInt(card.dataset.index, 10);
      if (newOver === dragSrcIndex) return;
      if (newOver !== dragOverIndex) {
        grid.querySelectorAll('.bank-card').forEach(c => c.classList.remove('drag-over'));
        dragOverIndex = newOver;
        card.classList.add('drag-over');
      }
    });

    grid.addEventListener('dragleave', e => {
      const card = getCard(e.target);
      if (card && !card.contains(e.relatedTarget)) card.classList.remove('drag-over');
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      const card = getCard(e.target);
      if (!card) return;
      const dropIndex = parseInt(card.dataset.index, 10);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      App.reorderBanks(dragSrcIndex, dropIndex);
    });
  }

  // ─── Compare Table ──────────────────────────
  function renderCompareTable(banks, conditions) {
    const section = document.getElementById('section-compare');
    const wrapper = document.getElementById('compare-wrapper');
    if (!banks || banks.length < 1) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const plazo = conditions?.plazo || '—';

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
          if (bestFn && bestFn(getter) === i) cls = 'best';
          else if (worstFn && worstFn(getter) === i) cls = 'worst';
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
      const t = [g.tasacion, g.registro, g.notaria, g.gestoria, g.ajd, g.apertura, g.extras]
        .reduce((s, v) => s + (parseFloat(v) || 0), 0);
      return t > 0 ? t : null;
    }
    const headers = banks.map(b =>
      `<th data-color="${b.color}">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${colorGradient(b.color)};"></span>
          ${escapeHtml(b.name)}
        </div>
      </th>`
    ).join('');

    const colgroup = `<colgroup>
        <col class="col-label">
        ${banks.map(() => `<col class="col-bank">`).join('')}
      </colgroup>`;

    wrapper.innerHTML = `
      <table class="compare-table">
        ${colgroup}
        <thead><tr><th>Campo</th>${headers}</tr></thead>
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

          ${sectionRow('💸 Otros Gastos', '')}
          ${row('Tasación', b => b.gastos?.tasacion, fmtEur, bestMin, worstMax)}
          ${row('Registro propiedad', b => b.gastos?.registro, fmtEur, bestMin, worstMax)}
          ${row('Notaría', b => b.gastos?.notaria, fmtEur, bestMin, worstMax)}
          ${row('Gestoría', b => b.gastos?.gestoria, fmtEur, bestMin, worstMax)}
          ${row('Impuesto AJD', b => b.gastos?.ajd, fmtEur, bestMin, worstMax)}
          ${row('Comisión de apertura', b => b.gastos?.apertura, fmtEur, bestMin, worstMax)}
          ${row('Otros extras', b => b.gastos?.extras, fmtEur, bestMin, worstMax)}
          ${row('TOTAL otros gastos', totalGastos, fmtEur, bestMin, worstMax)}
          ${row('Anotaciones', b => b.gastos?.notas || null, v => `<span class="table-notes">${escapeHtml(v)}</span>`, null, null)}

          ${sectionRow('⭐ Bonificaciones', 'purple')}
          ${row('Domiciliar nómina', b => b.bonificaciones?.nominaActiva ? (b.bonificaciones.nominaReduction ? '-' + b.bonificaciones.nominaReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Seguro de vida', b => b.bonificaciones?.vidaActiva ? (b.bonificaciones.vidaReduction ? '-' + b.bonificaciones.vidaReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Coste seg. vida (€/año)', b => b.bonificaciones?.vidaActiva ? b.bonificaciones.vidaCoste : null, fmtEur, bestMin, worstMax)}
          ${row('Seguro de hogar', b => b.bonificaciones?.hogarActiva ? (b.bonificaciones.hogarReduction ? '-' + b.bonificaciones.hogarReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Coste seg. hogar (€/año)', b => b.bonificaciones?.hogarActiva ? b.bonificaciones.hogarCoste : null, fmtEur, bestMin, worstMax)}
          ${row('Tarjeta de crédito', b => b.bonificaciones?.tarjetaActiva ? (b.bonificaciones.tarjetaReduction ? '-' + b.bonificaciones.tarjetaReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Coste tarjeta (€/año)', b => b.bonificaciones?.tarjetaActiva ? b.bonificaciones.tarjetaCoste : null, fmtEur, bestMin, worstMax)}
          ${row('Alarma', b => b.bonificaciones?.alarmaActiva ? (b.bonificaciones.alarmaReduction ? '-' + b.bonificaciones.alarmaReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Coste alarma (€/mes)', b => b.bonificaciones?.alarmaActiva ? b.bonificaciones.alarmaCoste : null, fmtEur, bestMin, worstMax)}
          ${row('Prot. de pagos', b => b.bonificaciones?.sppActiva ? (b.bonificaciones.sppReduction ? '-' + b.bonificaciones.sppReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('Coste prot. pagos (€ único)', b => b.bonificaciones?.sppActiva ? b.bonificaciones.sppCoste : null, fmtEur, bestMin, worstMax)}
          ${row('Fondos de inversión', b => b.bonificaciones?.fondosActiva ? (b.bonificaciones.fondosReduction ? '-' + b.bonificaciones.fondosReduction + ' %' : 'Sí') : null, v => v, null, null)}
          ${row('F. inversión mín. (€)', b => b.bonificaciones?.fondosActiva ? b.bonificaciones.fondosMinimo : null, fmtEur, bestMin, worstMax)}
          ${row('Anotaciones', b => b.bonificaciones?.notas || null, v => `<span class="table-notes">${escapeHtml(v)}</span>`, null, null)}
        </tbody>
      </table>`;

    // ─── Sticky clone header ─────────────────
    if (_stickyCleanup) { _stickyCleanup(); _stickyCleanup = null; }
    _stickyCleanup = _initStickyHeader(wrapper);
  }

  // ─── Bank Filter Bar ────────────────────────
  function renderBankFilter(banks, hiddenBanks) {
    const el = document.getElementById('bank-filter');
    if (!el) return;
    if (!banks || banks.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';

    const wasOpen = el.querySelector('details')?.open ?? window.innerWidth > 800;

    el.innerHTML = `
      <details class="bank-filter-details" ${wasOpen ? 'open' : ''}>
        <summary class="bank-filter-summary">
          <div class="summary-left">
             <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 4H21M6 12H18M9 20H15"/></svg>
             <span class="bank-filter-label">Mostrar en tabla (${banks.length - hiddenBanks.size}/${banks.length})</span>
          </div>
          <svg class="summary-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        <div class="bank-filter-chips">
          ${banks.map((b, i) => {
      const hidden = hiddenBanks.has(i);
      const dot = `<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${colorGradient(b.color)};"></span>`;
      return `<button class="bank-filter-chip ${hidden ? 'chip-hidden' : 'chip-visible'}" onclick="App.toggleBankVisibility(${i})" title="${hidden ? 'Mostrar' : 'Ocultar'} ${escapeHtml(b.name)}">${dot}${escapeHtml(b.name)}</button>`;
    }).join('')}
        </div>
      </details>
    `;
  }

  function _initStickyHeader(wrapper) {
    const table = wrapper.querySelector('.compare-table');
    if (!table) return null;
    const thead = table.querySelector('thead');
    if (!thead) return null;

    // Build the fixed clone bar
    const bar = document.createElement('div');
    bar.className = 'sticky-col-header';
    const innerTable = document.createElement('table');
    innerTable.className = 'compare-table';
    innerTable.style.tableLayout = 'fixed';
    innerTable.style.width = '100%';
    innerTable.appendChild(thead.cloneNode(true));
    bar.appendChild(innerTable);
    document.body.appendChild(bar);

    function syncAndShow() {
      const realThs = thead.querySelectorAll('th');
      const cloneThs = bar.querySelectorAll('th');
      const tableRect = table.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();

      realThs.forEach((th, i) => {
        if (cloneThs[i]) {
          const rect = th.getBoundingClientRect();
          // Ensure exact width syncing without being overridden by CSS limits
          cloneThs[i].style.width = rect.width + 'px';
          cloneThs[i].style.minWidth = rect.width + 'px';
          cloneThs[i].style.maxWidth = rect.width + 'px';
        }
      });

      bar.style.paddingLeft = '0px';
      bar.style.paddingRight = '0px';

      // Ensure the container for the fixed header itself is clipped to the visible table wrapper window
      bar.style.left = Math.max(0, wrapperRect.left) + 'px';
      bar.style.width = Math.min(window.innerWidth, wrapperRect.width) + 'px';
      bar.style.right = 'auto'; // overriding any previous 'right' usage

      // The cloned inner table needs to scale to its contents
      innerTable.style.width = 'auto';
      // Translate the inner table by negative scroll offset
      innerTable.style.transform = `translateX(-${wrapper.scrollLeft}px)`;

      bar.classList.add('visible');
    }

    function hide() { bar.classList.remove('visible'); }

    function onScroll() {
      let navHeight = 64;
      if (window.innerWidth <= 800) {
        const syncEl = document.querySelector('.sync-status');
        if (syncEl) {
          navHeight = syncEl.getBoundingClientRect().bottom;
        }
      } else {
        const headerEl = document.querySelector('.app-header');
        navHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;
      }

      // Show when the bottom edge of the real thead has gone above the navbar
      if (thead.getBoundingClientRect().bottom <= navHeight) {
        bar.style.top = navHeight + 17 + 'px';
        syncAndShow();
      } else {
        hide();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    wrapper.addEventListener('scroll', onScroll, { passive: true });

    // Initial check (in case page loads already scrolled)
    onScroll();

    return function cleanup() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      wrapper.removeEventListener('scroll', onScroll);
      bar.remove();
    };
  }

  return {
    showToast,
    setSyncStatus,
    applyConditionsToUI,
    updateGastosTotal,
    renderBanksGrid,
    renderCompareTable,
    renderBankFilter,
    fmtEur, fmtPct,
    escapeHtml,
  };
})();
