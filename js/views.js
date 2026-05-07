/* =============================================
   js/views.js — Navegación entre vistas
   Gestiona el cambio entre Comparador y Amortización
   ============================================= */

'use strict';

const Views = (() => {

    const VIEWS = ['comparador', 'amortizacion'];

    function show(viewId) {
        if (!VIEWS.includes(viewId)) return;

        // Ocultar todas las vistas
        VIEWS.forEach(id => {
            const view       = document.getElementById(`view-${id}`);
            const btn        = document.getElementById(`nav-${id}`);
            const mobileBtn  = document.getElementById(`mobile-nav-${id}`);
            if (view)      view.classList.remove('active');
            if (btn)       btn.classList.remove('active');
            if (mobileBtn) mobileBtn.classList.remove('active');
        });

        // Mostrar la vista seleccionada
        const view      = document.getElementById(`view-${viewId}`);
        const btn       = document.getElementById(`nav-${viewId}`);
        const mobileBtn = document.getElementById(`mobile-nav-${viewId}`);
        if (view)      view.classList.add('active');
        if (btn)       btn.classList.add('active');
        if (mobileBtn) mobileBtn.classList.add('active');

        // Scroll al top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Si cambiamos a amortización, sincronizar datos del comparador y redibujar
        if (viewId === 'amortizacion') {
            if (typeof Amort !== 'undefined') {
                Amort.syncFromState();   // rellena vacíos desde App.state
                Amort.redrawChart();     // redibuja si ya había datos
            }
        }
    }

    return { show };

})();
