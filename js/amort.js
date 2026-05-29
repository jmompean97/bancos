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
    let _euriborData = {};         // key: 'YYYY-MM' -> rate
    let _latestEuribor = 0;
    let _latestEuriborDate = '';

    const LS_KEY = 'bancocomp-amort-inputs';

    // ─── Persistencia de inputs en localStorage ──
    function saveInputs() {
        const data = {
            tipo: document.getElementById('amort-tipo')?.value || 'fija',
            capital: document.getElementById('amort-capital')?.value || '',
            interes: document.getElementById('amort-interes')?.value || '',
            plazo: document.getElementById('amort-plazo')?.value || '',
            fecha: document.getElementById('amort-fecha')?.value || '',
            diferencial: document.getElementById('amort-diferencial')?.value || '',
            aniosFijo: document.getElementById('amort-anios-fijo')?.value || '',
            extras: _amortizacionesExtra // save extra amortizations
        };
        localStorage.setItem(LS_KEY, JSON.stringify(data));
    }

    function loadInputs() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.tipo) _setField('amort-tipo', data.tipo);
            if (data.capital) _setField('amort-capital', data.capital);
            if (data.interes) _setField('amort-interes', data.interes);
            if (data.plazo) _setField('amort-plazo', data.plazo);
            if (data.fecha) _setField('amort-fecha', data.fecha);
            if (data.diferencial) _setField('amort-diferencial', data.diferencial);
            if (data.aniosFijo) _setField('amort-anios-fijo', data.aniosFijo);
            if (data.extras) _amortizacionesExtra = data.extras;
            changeTipo(); // update UI
            return !!(data.capital && data.plazo);
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

    // ─── Fetch Euribor ──────────────────────────
    async function fetchEuribor() {
        try {
            const res = await fetch('https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?detail=dataonly&format=jsondata');
            const data = await res.json();
            const obs = data.dataSets[0].series['0:0:0:0:0:0:0'].observations;
            const periods = data.structure.dimensions.observation[0].values;
            
            for(let i = 0; i < periods.length; i++) {
                const periodId = periods[i].id; // "2024-05"
                if(obs[i]) {
                    _euriborData[periodId] = obs[i][0];
                    _latestEuribor = obs[i][0];
                    _latestEuriborDate = periodId;
                }
            }
            const el = document.getElementById('amort-euribor-val');
            if(el) el.textContent = _latestEuribor.toFixed(3) + ' %';
            const elDate = document.getElementById('euribor-date');
            if(elDate) elDate.textContent = '(' + _latestEuriborDate + ')';
            calcular();
        } catch(e) {
            console.error("Error fetching Euribor", e);
            const el = document.getElementById('amort-euribor-val');
            if(el) el.textContent = 'Error API';
        }
    }

    // ─── UI: Change Tipo ────────────────────────
    function changeTipo() {
        const tipo = document.getElementById('amort-tipo')?.value || 'fija';
        
        const grpAnios = document.getElementById('grp-amort-anios-fijo');
        const grpInt = document.getElementById('grp-amort-interes');
        const grpDif = document.getElementById('grp-amort-diferencial');
        const grpEur = document.getElementById('grp-amort-euribor');
        const lblInt = document.getElementById('lbl-amort-interes');

        if(tipo === 'fija') {
            if(grpAnios) grpAnios.style.display = 'none';
            if(grpInt) grpInt.style.display = '';
            if(lblInt) lblInt.textContent = 'TIN Fijo (%)';
            if(grpDif) grpDif.style.display = 'none';
            if(grpEur) grpEur.style.display = 'none';
        } else if(tipo === 'variable') {
            if(grpAnios) grpAnios.style.display = 'none';
            if(grpInt) grpInt.style.display = 'none';
            if(grpDif) grpDif.style.display = '';
            if(grpEur) grpEur.style.display = '';
        } else if(tipo === 'mixta') {
            if(grpAnios) grpAnios.style.display = '';
            if(grpInt) grpInt.style.display = '';
            if(lblInt) lblInt.textContent = 'TIN Fijo Inicial (%)';
            if(grpDif) grpDif.style.display = '';
            if(grpEur) grpEur.style.display = '';
        }
        calcular();
    }

    // ─── Cálculo del cuadro (método francés BdE) ─
    // signingDay: día del mes en que se firmó la hipoteca (1–31).
    // Si es > 1, se inserta una fila 0 con los intereses proporcionales del
    // período desde la firma hasta fin de mes, calculados como:
    //   capital × (TIN/100) × (días_restantes / 365)
    // donde días_restantes = días del mes − día firma.
    // Las cuotas regulares arrancan el mes siguiente y se numeran desde 2.
    function buildCuadro(capital, plazoAnos, firstYear, firstMonth, tipo, interesFijo, diferencial, aniosFijo, signingDay) {
        const n = plazoAnos * 12;
        const V = capital;

        const rows = [];
        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth() + 1;
        const isLastDay = today.getDate() === new Date(todayY, todayM, 0).getDate();

        // ─── Período inicial parcial (firma a mitad de mes) ───
        let numOffset = 0;              // offset de numeración para cuotas regulares
        let regularYear  = firstYear;
        let regularMonth = firstMonth;
        let totalInteresesAcum = 0;
        let totalCapitalAcum   = 0;

        if (signingDay && signingDay > 1) {
            numOffset = 1;
            const daysInMonth   = new Date(firstYear, firstMonth, 0).getDate(); // último día del mes
            const daysRemaining = daysInMonth - signingDay;                     // días desde el día siguiente a la firma hasta fin de mes

            // Tipo de interés aplicable al período parcial
            let rateForBroken = interesFijo;
            if (tipo === 'variable') {
                const yyyymm = `${firstYear}-${firstMonth.toString().padStart(2, '0')}`;
                const eur = _euriborData[yyyymm] !== undefined ? _euriborData[yyyymm] : _latestEuribor;
                rateForBroken = eur + diferencial;
            }
            // mixta: el período inicial siempre cae en el tramo fijo

            const brokenInterest = daysRemaining > 0
                ? Math.round(capital * (rateForBroken / 100) * (daysRemaining / 365) * 100) / 100
                : 0;

            totalInteresesAcum = brokenInterest;

            const isPaidBroken = (todayY > firstYear) ||
                                 (todayY === firstYear && todayM > firstMonth) ||
                                 (todayY === firstYear && todayM === firstMonth && isLastDay);

            rows.push({
                num: 1,
                year: firstYear, month: firstMonth,
                label: mesLabel(firstYear, firstMonth),
                cuota: brokenInterest,
                intereses: brokenInterest,
                capital: 0,
                pendiente: capital,
                pctPagado: 0,
                totalInteresesAcum: Math.round(totalInteresesAcum * 100) / 100,
                totalCapitalAcum: 0,
                extra: null,
                isBrokenPeriod: true,   // marcador para el renderer
                isPaid: isPaidBroken
            });

            // Las cuotas regulares arrancan el mes siguiente
            regularMonth = firstMonth + 1;
            if (regularMonth > 12) { regularMonth = 1; regularYear = firstYear + 1; }
        }

        // ─── Amortización francesa regular ───
        let capitalPendiente = V;
        let year  = regularYear;
        let month = regularMonth;

        let currentInteresAnual = interesFijo;
        if (tipo === 'variable') {
            const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
            const eur = _euriborData[yyyymm] !== undefined ? _euriborData[yyyymm] : _latestEuribor;
            currentInteresAnual = eur + diferencial;
        }

        let lastInteresAnual = currentInteresAnual;
        let i = Math.max(0, lastInteresAnual / 100 / 12);

        let cuotaMensual;
        if (i <= 0) {
            cuotaMensual = Math.round((V / n) * 100) / 100;
        } else {
            const exactC = V * (i / (1 - Math.pow(1 + i, -n)));
            cuotaMensual = Math.round(exactC * 100) / 100;
        }

        for (let m = 1; m <= n; m++) {
            if (capitalPendiente <= 0) {
                rows.push({
                    num: m + numOffset,
                    year, month,
                    label: mesLabel(year, month),
                    cuota: 0, intereses: 0, capital: 0, pendiente: 0,
                    pctPagado: 100,
                    isSaved: true,
                    isPaid: false
                });
                month++;
                if (month > 12) { month = 1; year++; }
                continue;
            }

            // Tipo de interés de este mes
            let interesAnualMes = interesFijo;
            if (tipo === 'variable') {
                const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
                const eur = _euriborData[yyyymm] !== undefined ? _euriborData[yyyymm] : _latestEuribor;
                interesAnualMes = eur + diferencial;
            } else if (tipo === 'mixta') {
                if (m > aniosFijo * 12) {
                    const yyyymm = `${year}-${month.toString().padStart(2, '0')}`;
                    const eur = _euriborData[yyyymm] !== undefined ? _euriborData[yyyymm] : _latestEuribor;
                    interesAnualMes = eur + diferencial;
                }
            }

            if (interesAnualMes !== lastInteresAnual) {
                lastInteresAnual = interesAnualMes;
                i = Math.max(0, lastInteresAnual / 100 / 12);
                let remainingPeriods = n - m + 1;
                if (remainingPeriods > 0) {
                    if (i <= 0) {
                        cuotaMensual = Math.round((capitalPendiente / remainingPeriods) * 100) / 100;
                    } else {
                        const exactC = capitalPendiente * (i / (1 - Math.pow(1 + i, -remainingPeriods)));
                        cuotaMensual = Math.round(exactC * 100) / 100;
                    }
                }
            }

            const interesesMes = i <= 0 ? 0 : Math.round(capitalPendiente * i * 100) / 100;
            let cuotaMes   = cuotaMensual;
            let capitalMes = cuotaMes - interesesMes;

            // Ajuste última cuota
            if (m === n || (capitalPendiente + interesesMes) <= cuotaMensual) {
                cuotaMes   = Math.round((capitalPendiente + interesesMes) * 100) / 100;
                capitalMes = capitalPendiente;
            }

            capitalPendiente = Math.round((capitalPendiente - capitalMes) * 100) / 100;
            if (capitalPendiente < 0) capitalPendiente = 0;

            totalInteresesAcum += interesesMes;
            totalCapitalAcum   += capitalMes;

            let extraInfo = null;

            // ===== CHECK EXTRA AMORTIZACIÓN EN ESTA CUOTA =====
            const extra = _amortizacionesExtra[m + numOffset];
            if (extra && capitalPendiente > 0) {
                let extraCapital = Math.min(extra.importe, capitalPendiente);

                let pctComision = 0;
                if (m <= 120)       pctComision = 0.02;
                else if (m <= 240)  pctComision = 0.015;

                let comisionExtra = Math.round((extraCapital * pctComision) * 100) / 100;

                capitalPendiente  = Math.round((capitalPendiente - extraCapital) * 100) / 100;
                totalCapitalAcum += extraCapital;

                extraInfo = { importe: extraCapital, comision: comisionExtra, tipo: extra.tipo };

                if (extra.tipo === 'cuota' && capitalPendiente > 0) {
                    let remainingPeriods = n - m;
                    if (remainingPeriods > 0) {
                        if (i <= 0) {
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
                num: m + numOffset,
                year, month,
                label: mesLabel(year, month),
                cuota: cuotaMes,
                intereses: interesesMes,
                capital: capitalMes,
                pendiente: capitalPendiente,
                pctPagado: ((V - capitalPendiente) / V) * 100,
                totalInteresesAcum: Math.round(totalInteresesAcum * 100) / 100,
                totalCapitalAcum:   Math.round(totalCapitalAcum   * 100) / 100,
                extra: extraInfo,
                isVariableStart: (tipo === 'mixta' && m === (aniosFijo * 12 + 1)),
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
        const plazo = parseInt(document.getElementById('amort-plazo')?.value, 10);
        const tipo = document.getElementById('amort-tipo')?.value || 'fija';
        const interesFijo = parseFloat(document.getElementById('amort-interes')?.value) || 0;
        const diferencial = parseFloat(document.getElementById('amort-diferencial')?.value) || 0;
        const aniosFijo = parseInt(document.getElementById('amort-anios-fijo')?.value, 10) || 0;
        const fechaEl = document.getElementById('amort-fecha')?.value; // "YYYY-MM-DD"

        saveInputs();

        // Basic validation
        if (!capital || !plazo || capital <= 0 || plazo <= 0) { _hideAll(); return; }
        if (tipo === 'fija'  && interesFijo < 0)                { _hideAll(); return; }
        if (tipo === 'mixta' && (interesFijo < 0 || aniosFijo <= 0)) { _hideAll(); return; }

        let firstYear, firstMonth, signingDay = 1;
        if (fechaEl) {
            const parts = fechaEl.split('-');
            firstYear  = parseInt(parts[0], 10);
            firstMonth = parseInt(parts[1], 10);
            signingDay = parts[2] ? parseInt(parts[2], 10) : 1;
        } else {
            // Valor por defecto para visualizar al menos una cuota pagada
            firstYear  = 2026;
            firstMonth = 4;
            _setField('amort-fecha', '2026-04-01');
        }

        _cuadro = buildCuadro(capital, plazo, firstYear, firstMonth, tipo, interesFijo, diferencial, aniosFijo, signingDay);
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
        const cuadroBase = buildCuadro(capital, plazo, firstYear, firstMonth, tipo, interesFijo, diferencial, aniosFijo, signingDay);
        _amortizacionesExtra = oldExtras;

        const totalInteresesBase = cuadroBase.reduce((s, r) => s + r.intereses, 0);
        const totalPagadoBase = cuadroBase.reduce((s, r) => s + r.cuota, 0);

        const ahorroIntereses = totalInteresesBase - totalIntereses;
        const ahorroTotal = totalPagadoBase - totalAbonado;

        // Resumen
        _show('amort-summary');
        // Cuota regular = la primera fila que NO sea el período parcial
        const firstRegular = _cuadro.find(r => !r.isBrokenPeriod);
        const cuotaNormal  = firstRegular ? firstRegular.cuota : _cuadro[0].cuota;
        const hasBroken    = _cuadro.some(r => r.isBrokenPeriod);
        const elCuota      = document.getElementById('amort-sum-cuota');
        if (hasBroken) {
            elCuota.innerHTML = `${fmt(cuotaNormal)} <br><small style="color:#f59e0b; font-weight:600; font-size:0.75rem;">(1ª cuota parcial: ${fmt(_cuadro[0].cuota)})</small>`;
        } else {
            elCuota.textContent = fmt(cuotaNormal);
        }
        
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

            // ─── Fila período parcial inicial ───
            if (r.isBrokenPeriod) {
                const paidHtml = r.isPaid
                    ? `<span class="amort-paid-check" title="Cuota pagada"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span>`
                    : '';
                return `<tr class="amort-row ${r.isPaid ? 'is-paid' : ''}" style="background: rgba(245,158,11,0.05);">
                    <td class="amort-td-num">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            ${r.num} ${paidHtml}
                        </div>
                    </td>
                    <td class="amort-td-fecha">${r.label}</td>
                    <td class="amort-td-cuota">
                        ${fmt(r.cuota)}
                        <br><span style="font-size:0.7rem; color:#f59e0b; font-weight:600;">Cuota parcial</span>
                    </td>
                    <td class="amort-td-int">${fmt(r.intereses)}</td>
                    <td class="amort-td-cap"><span style="color:var(--text-muted); font-size:0.85rem;">0,00 €</span></td>
                    <td class="amort-td-pend">${fmt(r.pendiente)}</td>
                    <td class="amort-td-pct">
                        <div class="amort-pct-wrap">
                            <div class="amort-pct-bar" style="width:0%;background:#ef4444;"></div>
                            <span class="amort-pct-label">0,0 %</span>
                        </div>
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

            let changeHtml = '';
            if (r.isVariableStart) {
                changeHtml = `<tr class="amort-change-row">
                    <td colspan="8">
                        <div class="amort-change-content">
                            <div class="amort-change-line"></div>
                            <div class="amort-change-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
                                INICIO TRAMO VARIABLE
                            </div>
                            <div class="amort-change-line"></div>
                        </div>
                    </td>
                </tr>`;
            }

            return changeHtml + `<tr class="amort-row ${r.isPaid ? 'is-paid' : ''}">
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
        fetchEuribor();                  // Petición asíncrona del Euribor
        const hadSaved = loadInputs();   // restaura localStorage
        syncFromState();                 // rellena vacíos desde App.state
        // Si hay datos suficientes, calcular inmediatamente
        const capital = document.getElementById('amort-capital')?.value;
        const plazo = document.getElementById('amort-plazo')?.value;
        if (capital && plazo) calcular();
    }

    // ─── Public API ─────────────────────────────
    return {
        calcular, filtrarAnio, redrawChart, syncFromState, init, changeTipo,
        openExtraModal, closeExtraModal, closeExtraModalOnOverlay, calcExtraComision, saveExtraAmort, removeExtraAmort
    };

})();

// Redibujar chart al redimensionar ventana
window.addEventListener('resize', () => { Amort.redrawChart(); });
