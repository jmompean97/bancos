/* =============================================
   js/amort.js — Calculadora de Amortización
   Cuadro de amortización mensual (método francés)
   con gráfico de evolución del préstamo.
   ============================================= */

'use strict';

const Amort = (() => {

    // ─── Estado ─────────────────────────────────
    let _cuadro = [];          // Array con todas las filas calculadas
    let _aniosDisponibles = [];
    let _stickyCleanup = null;
    let _amortizacionesExtra = {}; // key: numCuota -> { importe, tipo }

    const LS_KEY = 'bancocomp-amort-inputs';

    // ─── Persistencia de inputs en localStorage ──
    function saveInputs() {
        const data = {
            capital: document.getElementById('amort-capital')?.value || '',
            interes: document.getElementById('amort-interes')?.value || '',
            plazo: document.getElementById('amort-plazo')?.value || '',
            fecha: document.getElementById('amort-fecha')?.value || '',
            extras: _amortizacionesExtra // save extra amortizations
        };
        localStorage.setItem(LS_KEY, JSON.stringify(data));
    }

    function loadInputs() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.capital) _setField('amort-capital', data.capital);
            if (data.interes) _setField('amort-interes', data.interes);
            if (data.plazo) _setField('amort-plazo', data.plazo);
            if (data.fecha) _setField('amort-fecha', data.fecha);
            if (data.extras) _amortizacionesExtra = data.extras;
            return !!(data.capital && data.interes && data.plazo);
        } catch (_) { return false; }
    }

    // Solo rellena si el campo está vacío
    function _setField(id, val) {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = val;
    }

    // ─── Sync desde el estado del Comparador ────
    function syncFromState() {
        try {
            const state = (typeof App !== 'undefined' && App.getState) ? App.getState() : null;
            if (!state) return;

            const conds = state.conditions;
            const bank0 = (state.banks || [])[0];

            // Capital
            const capitalEl = document.getElementById('amort-capital');
            if (capitalEl && !capitalEl.value && conds) {
                const pct = parseFloat(bank0?.bancoFinanciacion);
                const inmueble = parseFloat(conds.inmueble);
                if (pct > 0 && inmueble > 0) {
                    capitalEl.value = Math.round((pct / 100) * inmueble);
                } else if (conds.importe) {
                    capitalEl.value = conds.importe;
                }
            }

            // Interés bonificado del primer banco
            const interesEl = document.getElementById('amort-interes');
            if (interesEl && !interesEl.value && bank0) {
                const interes = parseFloat(bank0.fijaBon?.interes);
                if (interes > 0) interesEl.value = interes;
            }

            // Plazo del primer banco
            const plazoEl = document.getElementById('amort-plazo');
            if (plazoEl && !plazoEl.value && bank0?.bancoPlazo) {
                plazoEl.value = bank0.bancoPlazo;
            }
        } catch (_) {
            // silencioso si App no está disponible
        }
    }

    // ─── Utilidades ─────────────────────────────
    function fmt(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    function fmtPct(n) {
        return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    }

    function mesLabel(year, month) {
        const fecha = new Date(year, month - 1, 1);
        return fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    }

    // ─── Cálculo del cuadro (método francés BdE) ─
    function buildCuadro(capital, interesAnual, plazoAnos, firstYear, firstMonth) {
        const i = interesAnual / 100 / 12;
        const n = plazoAnos * 12;
        const V = capital;

        let cuotaMensual;
        if (i === 0) {
            cuotaMensual = Math.round((V / n) * 100) / 100;
        } else {
            const exactC = V * (i / (1 - Math.pow(1 + i, -n)));
            cuotaMensual = Math.round(exactC * 100) / 100;
        }

        const rows = [];
        let capitalPendiente = V;
        let year = firstYear;
        let month = firstMonth;
        let totalInteresesAcum = 0;
        let totalCapitalAcum = 0;

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth() + 1;
        // Obtenemos el último día del mes actual (día 0 del mes siguiente)
        const isLastDay = today.getDate() === new Date(todayY, todayM, 0).getDate();

        for (let m = 1; m <= n; m++) {
            if (capitalPendiente <= 0) {
                rows.push({
                    num: m,
                    year, month,
                    label: mesLabel(year, month),
                    cuota: 0,
                    intereses: 0,
                    capital: 0,
                    pendiente: 0,
                    pctPagado: 100,
                    isSaved: true,
                    isPaid: false
                });
                month++;
                if (month > 12) { month = 1; year++; }
                continue;
            }

            const interesesMes = Math.round(capitalPendiente * i * 100) / 100;
            let cuotaMes = cuotaMensual;
            let capitalMes = cuotaMes - interesesMes;

            // Ajuste última cuota
            if (m === n || (capitalPendiente + interesesMes) <= cuotaMensual) {
                cuotaMes = Math.round((capitalPendiente + interesesMes) * 100) / 100;
                capitalMes = capitalPendiente;
            }

            capitalPendiente = Math.round((capitalPendiente - capitalMes) * 100) / 100;
            if (capitalPendiente < 0) capitalPendiente = 0;

            totalInteresesAcum += interesesMes;
            totalCapitalAcum += capitalMes;

            let extraInfo = null;

            // ===== CHECK EXTRA AMORTIZACIÓN EN ESTA CUOTA =====
            const extra = _amortizacionesExtra[m];
            if (extra && capitalPendiente > 0) {
                let extraCapital = Math.min(extra.importe, capitalPendiente); // no sobre-amortizar

                // Calcular comisión: 2% primeros 10 años, 1.5% años 11-20, 0% después
                let pctComision = 0;
                if (m <= 120) pctComision = 0.02;
                else if (m <= 240) pctComision = 0.015;
                else pctComision = 0;

                let comisionExtra = Math.round((extraCapital * pctComision) * 100) / 100;

                capitalPendiente = Math.round((capitalPendiente - extraCapital) * 100) / 100;
                totalCapitalAcum += extraCapital;

                extraInfo = {
                    importe: extraCapital,
                    comision: comisionExtra,
                    tipo: extra.tipo
                };

                // Recalcular cuota si elige 'cuota' (mantener plazo)
                if (extra.tipo === 'cuota' && capitalPendiente > 0) {
                    let remainingPeriods = n - m;
                    if (remainingPeriods > 0) {
                        if (i === 0) {
                            cuotaMensual = Math.round((capitalPendiente / remainingPeriods) * 100) / 100;
                        } else {
                            const exactC = capitalPendiente * (i / (1 - Math.pow(1 + i, -remainingPeriods)));
                            cuotaMensual = Math.round(exactC * 100) / 100;
                        }
                    }
                }
            }

            const isPaid = (todayY > year) || 
                           (todayY === year && todayM > month) || 
                           (todayY === year && todayM === month && isLastDay);

            rows.push({
                num: m,
                year, month,
                label: mesLabel(year, month),
                cuota: cuotaMes,
                intereses: interesesMes,
                capital: capitalMes,
                pendiente: capitalPendiente,
                pctPagado: ((V - capitalPendiente) / V) * 100,
                totalInteresesAcum: Math.round(totalInteresesAcum * 100) / 100,
                totalCapitalAcum: Math.round(totalCapitalAcum * 100) / 100,
                extra: extraInfo,
                isPaid
            });

            month++;
            if (month > 12) { month = 1; year++; }
        }

        return rows;
    }

    // ─── Calcular y renderizar ───────────────────
    function calcular() {
        const capital = parseFloat(document.getElementById('amort-capital')?.value);
        const interes = parseFloat(document.getElementById('amort-interes')?.value);
        const plazo = parseInt(document.getElementById('amort-plazo')?.value, 10);
        const fechaEl = document.getElementById('amort-fecha')?.value; // "YYYY-MM"

        saveInputs();  // persistir siempre que el usuario escribe o cambia algo

        if (!capital || !interes || !plazo || capital <= 0 || plazo <= 0 || interes < 0) {
            _hideAll();
            return;
        }

        let firstYear, firstMonth;
        if (fechaEl) {
            const parts = fechaEl.split('-');
            firstYear = parseInt(parts[0], 10);
            firstMonth = parseInt(parts[1], 10);
        } else {
            // Forzar fecha de test a Abril 2026 si no hay nada introducido, para visualizar una cuota pagada
            firstYear = 2026;
            firstMonth = 4;
            _setField('amort-fecha', '2026-04');
        }

        _cuadro = buildCuadro(capital, interes, plazo, firstYear, firstMonth);
        if (_cuadro.length === 0) { _hideAll(); return; }

        const totalIntereses = _cuadro.reduce((s, r) => s + r.intereses, 0);
        const totalPagado = _cuadro.reduce((s, r) => s + r.cuota, 0);
        const totalExtras = _cuadro.reduce((s, r) => s + (r.extra ? r.extra.importe : 0), 0);
        const totalComisiones = _cuadro.reduce((s, r) => s + (r.extra ? r.extra.comision : 0), 0);
        const totalAbonado = totalPagado + totalExtras + totalComisiones;
        const savedCount = _cuadro.filter(r => r.isSaved).length;
        const activeCount = _cuadro.length - savedCount;

        // Calcular contra caso base sin amortizaciones extra
        const oldExtras = _amortizacionesExtra;
        _amortizacionesExtra = {};
        const cuadroBase = buildCuadro(capital, interes, plazo, firstYear, firstMonth);
        _amortizacionesExtra = oldExtras;

        const totalInteresesBase = cuadroBase.reduce((s, r) => s + r.intereses, 0);
        const totalPagadoBase = cuadroBase.reduce((s, r) => s + r.cuota, 0);

        const ahorroIntereses = totalInteresesBase - totalIntereses;
        const ahorroTotal = totalPagadoBase - totalAbonado;

        // Resumen
        _show('amort-summary');
        document.getElementById('amort-sum-cuota').textContent = fmt(_cuadro[0].cuota);
        
        const elInt = document.getElementById('amort-sum-intereses');
        const fmtInt = fmt(Math.round(totalIntereses * 100) / 100);
        if (ahorroIntereses > 0) {
            elInt.innerHTML = `${fmtInt} <br><small style="color:#10b981; font-weight:600; font-size:0.8rem;">(¡${fmt(ahorroIntereses)} ahorrados!)</small>`;
        } else {
            elInt.textContent = fmtInt;
        }

        const elTot = document.getElementById('amort-sum-total');
        const fmtTot = fmt(Math.round(totalAbonado * 100) / 100);
        if (ahorroTotal > 0) {
            elTot.innerHTML = `${fmtTot} <br><small style="color:#10b981; font-weight:600; font-size:0.8rem;">(¡${fmt(ahorroTotal)} ahorrados!)</small>`;
        } else {
            elTot.textContent = fmtTot;
        }

        const sumCuotasEl = document.getElementById('amort-sum-cuotas');
        if (savedCount > 0) {
            sumCuotasEl.innerHTML = `${activeCount} meses <br><small style="color:#10b981; font-weight:600; font-size:0.8rem;">(¡${savedCount} ahorrados!)</small>`;
        } else {
            sumCuotasEl.textContent = `${activeCount} meses`;
        }

        // Filtro por año
        _aniosDisponibles = [...new Set(_cuadro.map(r => r.year))];
        const sel = document.getElementById('amort-year-filter');
        if (sel) {
            sel.innerHTML = '<option value="todos">Todos los años</option>' +
                _aniosDisponibles.map(y => `<option value="${y}">${y}</option>`).join('');
        }

        // Tabla y gráfico
        _show('section-amort-table');
        _renderTabla(_cuadro);
        _show('section-amort-chart');
        _renderChart(_cuadro, capital);
    }

    function _hideAll() {
        ['amort-summary', 'section-amort-chart', 'section-amort-table'].forEach(id => _hide(id));
        _cuadro = [];
    }

    function _hide(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    function _show(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    }

    // ─── Modal Amortización Extra ───────────────
    function openExtraModal(numCuota, capitalPendiente) {
        const modal = document.getElementById('modal-amort-extra');
        if (modal) modal.classList.add('open');

        document.getElementById('extra-num-cuota').value = numCuota;
        document.getElementById('extra-modal-cuota').textContent = numCuota;
        document.getElementById('extra-modal-pend').textContent = fmt(capitalPendiente);

        const existing = _amortizacionesExtra[numCuota];
        if (existing) {
            document.getElementById('extra-importe').value = existing.importe;
            document.getElementById('extra-tipo').value = existing.tipo;
            document.getElementById('btn-extra-remove').style.display = 'inline-block';
        } else {
            document.getElementById('extra-importe').value = '';
            document.getElementById('extra-tipo').value = 'plazo';
            document.getElementById('btn-extra-remove').style.display = 'none';
        }
        calcExtraComision();
    }

    function calcExtraComision() {
        const numCuota = parseInt(document.getElementById('extra-num-cuota').value, 10);
        const importe = parseFloat(document.getElementById('extra-importe').value) || 0;
        let pct = 0;
        if (numCuota <= 120) pct = 0.02;
        else if (numCuota <= 240) pct = 0.015;

        document.getElementById('extra-modal-comision').textContent = fmt(importe * pct);
    }

    function saveExtraAmort() {
        const numCuota = parseInt(document.getElementById('extra-num-cuota').value, 10);
        const importe = parseFloat(document.getElementById('extra-importe').value);
        const tipo = document.getElementById('extra-tipo').value;

        if (!importe || importe <= 0) return;

        _amortizacionesExtra[numCuota] = { importe, tipo };
        closeExtraModal();
        calcular();
    }

    function removeExtraAmort() {
        const numCuota = parseInt(document.getElementById('extra-num-cuota').value, 10);
        delete _amortizacionesExtra[numCuota];
        closeExtraModal();
        calcular();
    }

    function closeExtraModal() {
        const modal = document.getElementById('modal-amort-extra');
        if (modal) modal.classList.remove('open');
    }

    function closeExtraModalOnOverlay(e) {
        if (e.target.id === 'modal-amort-extra') closeExtraModal();
    }

    // ─── Tabla ──────────────────────────────────
    function _renderTabla(rows) {
        const tbody = document.getElementById('amort-tbody');
        if (!tbody) return;

        tbody.innerHTML = rows.map(r => {
            if (r.isSaved) {
                return `<tr class="amort-row" style="opacity: 0.4; background: rgba(0,0,0,0.02);">
                    <td class="amort-td-num">${r.num}</td>
                    <td class="amort-td-fecha">${r.label}</td>
                    <td colspan="4" style="text-align:center; font-size:0.85rem; font-style:italic;">Cuota ahorrada</td>
                    <td class="amort-td-pct">
                        <span class="amort-pct-label">100.0 %</span>
                    </td>
                    <td class="amort-td-extra"></td>
                </tr>`;
            }

            const pctBar = Math.min(100, r.pctPagado).toFixed(1);
            const barColor = r.pctPagado < 33 ? '#ef4444' : r.pctPagado < 66 ? '#f59e0b' : '#10b981';

            let extraHtml = '';
            if (r.extra) {
                extraHtml = `<div class="extra-badge" title="Comisión banco: ${fmt(r.extra.comision)}">
                    -${fmt(r.extra.importe)} <small>(${r.extra.tipo === 'cuota' ? '↓ cuota' : '↓ plazo'})</small>
                </div>
                <button class="btn-amort-action active" onclick="Amort.openExtraModal(${r.num}, ${r.pendiente + r.extra.importe})" title="Editar">✎</button>`;
            } else {
                extraHtml = `<button class="btn-amort-action" onclick="Amort.openExtraModal(${r.num}, ${r.pendiente})" title="Añadir amortización extra">⚡</button>`;
            }

            const paidHtml = r.isPaid 
                ? `<span class="amort-paid-check" title="Cuota pagada"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span>`
                : '';

            return `<tr class="amort-row ${r.isPaid ? 'is-paid' : ''}">
                <td class="amort-td-num">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        ${r.num} ${paidHtml}
                    </div>
                </td>
                <td class="amort-td-fecha">${r.label}</td>
                <td class="amort-td-cuota">${fmt(r.cuota)}</td>
                <td class="amort-td-int">${fmt(r.intereses)}</td>
                <td class="amort-td-cap">${fmt(r.capital)}</td>
                <td class="amort-td-pend">${fmt(r.pendiente)}</td>
                <td class="amort-td-pct">
                    <div class="amort-pct-wrap">
                        <div class="amort-pct-bar" style="width:${pctBar}%;background:${barColor};"></div>
                        <span class="amort-pct-label">${fmtPct(r.pctPagado)}</span>
                    </div>
                </td>
                <td class="amort-td-extra">
                    ${extraHtml}
                </td>
            </tr>`;
        }).join('');

        if (_stickyCleanup) { _stickyCleanup(); _stickyCleanup = null; }
        const wrapper = document.querySelector('.amort-table-wrap');
        _stickyCleanup = _initStickyHeader(wrapper, '.amort-table');
    }

    function _initStickyHeader(wrapper, tableSelector) {
        if (!wrapper) return null;
        const table = wrapper.querySelector(tableSelector);
        if (!table) return null;
        const thead = table.querySelector('thead');
        if (!thead) return null;

        const bar = document.createElement('div');
        bar.className = 'sticky-col-header';

        const container = document.createElement('div');
        container.style.cssText = 'position:relative; width:100%; height:100%; overflow:hidden;';

        const innerTable = document.createElement('table');
        innerTable.className = table.className + ' sticky-clone';
        innerTable.style.cssText = 'position:absolute; margin:0; table-layout:fixed; border-collapse:collapse; width:auto; border-top:1px solid var(--border-color); border-bottom:2px solid rgba(59, 130, 246, 0.15);';

        const cloneThead = thead.cloneNode(true);
        innerTable.appendChild(cloneThead);

        container.appendChild(innerTable);
        bar.appendChild(container);
        document.body.appendChild(bar);

        function syncAndShow() {
            const tableRect = table.getBoundingClientRect();
            const realThs = thead.querySelectorAll('th');
            const cloneThs = cloneThead.querySelectorAll('th');

            innerTable.style.width = tableRect.width + 'px';
            innerTable.style.minWidth = tableRect.width + 'px';

            realThs.forEach((th, i) => {
                const w = th.getBoundingClientRect().width;
                if (cloneThs[i]) {
                    cloneThs[i].style.width = w + 'px';
                    cloneThs[i].style.minWidth = w + 'px';
                    cloneThs[i].style.maxWidth = w + 'px';
                    cloneThs[i].style.boxSizing = 'border-box';
                }
            });

            bar.style.left = '0';
            bar.style.width = '100%';
            bar.style.height = thead.getBoundingClientRect().height + 'px';
            innerTable.style.left = tableRect.left + 'px';

            if (!bar.classList.contains('visible')) {
                bar.classList.add('visible');
            }
        }

        function hide() { bar.classList.remove('visible'); }

        function onScroll() {
            let navHeight = 64;
            if (window.innerWidth <= 800) {
                const syncEl = document.querySelector('.sync-status');
                if (syncEl) navHeight = syncEl.getBoundingClientRect().bottom;
            } else {
                const headerEl = document.querySelector('.app-header');
                navHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;
            }

            // Show if the original thead has gone past the navHeight
            // and hide if we have scrolled past the entire table.
            if (thead.getBoundingClientRect().bottom <= navHeight && table.getBoundingClientRect().bottom > navHeight + 50) {
                const offset = window.innerWidth <= 800 ? 16 : 0;
                bar.style.top = (navHeight + offset) + 'px';
                syncAndShow();
            } else {
                hide();
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        wrapper.addEventListener('scroll', onScroll, { passive: true });

        onScroll();

        return function cleanup() {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            wrapper.removeEventListener('scroll', onScroll);
            bar.remove();
        };
    }

    // ─── Filtro por año ─────────────────────────
    function filtrarAnio() {
        const sel = document.getElementById('amort-year-filter');
        const val = sel?.value;
        if (!val || _cuadro.length === 0) return;
        const rows = val === 'todos' ? _cuadro : _cuadro.filter(r => r.year === parseInt(val, 10));
        _renderTabla(rows);
    }

    let _chartInstance = null;

    // ─── Gráfico con Chart.js ───────────────────
    function _renderChart(rows, capital) {
        const canvas = document.getElementById('amort-chart');
        if (!canvas) return;

        if (_chartInstance) {
            _chartInstance.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#94a3b8' : '#475569';

        const step = Math.max(1, Math.floor(rows.length / 120));
        const points = [];
        for (let i = 0; i < rows.length; i += step) points.push(rows[i]);
        if (points[points.length - 1] !== rows[rows.length - 1]) points.push(rows[rows.length - 1]);

        const labels = points.map(r => r.year);
        const dataPendiente = points.map(r => r.pendiente);
        const dataIntereses = points.map(r => r.totalInteresesAcum);
        const dataCapital = points.map(r => r.totalCapitalAcum);

        const ctx = canvas.getContext('2d');

        // Gradiente Capital Pendiente
        const gradPend = ctx.createLinearGradient(0, 0, 0, 300);
        gradPend.addColorStop(0, 'rgba(59,130,246,0.35)');
        gradPend.addColorStop(1, 'rgba(59,130,246,0.02)');

        // Gradiente Intereses
        const gradInt = ctx.createLinearGradient(0, 0, 0, 300);
        gradInt.addColorStop(0, 'rgba(239,68,68,0.25)');
        gradInt.addColorStop(1, 'rgba(239,68,68,0.02)');

        _chartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Capital Pendiente',
                        data: dataPendiente,
                        borderColor: '#3b82f6',
                        backgroundColor: gradPend,
                        borderWidth: 2.5,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        tension: 0.1
                    },
                    {
                        label: 'Capital Amortizado',
                        data: dataCapital,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        tension: 0.1
                    },
                    {
                        label: 'Intereses Acum.',
                        data: dataIntereses,
                        borderColor: '#ef4444',
                        borderDash: [6, 3],
                        borderWidth: 2,
                        backgroundColor: gradInt,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: false // Usamos la leyenda HTML existente
                    },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDark ? '#f1f5f9' : '#0f172a',
                        bodyColor: isDark ? '#94a3b8' : '#475569',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += fmt(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                            drawBorder: false,
                        },
                        ticks: {
                            color: textColor,
                            maxTicksLimit: 12,
                            maxRotation: 0,
                            font: { family: 'system-ui, -apple-system, sans-serif', size: 11 }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor,
                            drawBorder: false,
                        },
                        ticks: {
                            color: textColor,
                            font: { family: 'system-ui, -apple-system, sans-serif', size: 11 },
                            callback: function(value) {
                                return (value / 1000).toFixed(0) + 'k €';
                            }
                        }
                    }
                }
            }
        });
    }

    function redrawChart() {
        if (_cuadro.length > 0) {
            const capital = parseFloat(document.getElementById('amort-capital')?.value);
            if (capital) _renderChart(_cuadro, capital);
        }
    }

    // ─── Init: restaura inputs y calcula si hay datos ──
    function init() {
        const hadSaved = loadInputs();   // restaura localStorage
        syncFromState();                 // rellena vacíos desde App.state
        // Si hay datos suficientes, calcular inmediatamente
        const capital = document.getElementById('amort-capital')?.value;
        const interes = document.getElementById('amort-interes')?.value;
        const plazo = document.getElementById('amort-plazo')?.value;
        if (capital && interes && plazo) calcular();
    }

    // ─── Public API ─────────────────────────────
    return {
        calcular, filtrarAnio, redrawChart, syncFromState, init,
        openExtraModal, closeExtraModal, closeExtraModalOnOverlay, calcExtraComision, saveExtraAmort, removeExtraAmort
    };

})();

// Redibujar chart al redimensionar ventana
window.addEventListener('resize', () => { Amort.redrawChart(); });
