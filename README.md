<div align="center">

# 🏠 MiHipoteca

### Compara bancos · Calcula cuotas · Amortiza mes a mes

**La herramienta completa para tomar decisiones hipotecarias: compara condiciones entre bancos y visualiza tu cuadro de amortización completo.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/IndexedDB_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## ✨ ¿Qué es MiHipoteca?

Cuando pides una hipoteca, cada banco te da una oferta diferente con cientos de variables: tipos de interés, cuotas mensuales, gastos de formalización, bonificaciones por contratar seguros... **compararlo a mano en papel o Excel es un caos.**

**MiHipoteca** es una app web con dos módulos principales:

1. **Comparador de bancos** — Introduce las condiciones de cada banco y genera automáticamente una **tabla comparativa completa** donde los mejores valores aparecen en verde y los peores en rojo.
2. **Calculadora de amortización** — Introduce las condiciones definitivas de tu hipoteca y obtén el **cuadro de amortización mes a mes** (método francés), con simulación de aportaciones anticipadas, Euríbor real del BCE y gráficos interactivos.

Sin registro. Sin servidor. Sin instalar nada. Abre el archivo y listo.

---

## 🚀 Demo rápida

> Puedes usar la app directamente abriendo `index.html` en tu navegador, o sirviéndola desde un servidor local para activar opciones avanzadas (sincronización).

### Opción A — Servidor Local (Recomendado para Gist Sync)
Si vas a utilizar la opción de sincronización en la nube mediante **GitHub Gist**, por razones de seguridad de tu navegador (políticas CORS), necesitas levantar la app desde un servidor web en lugar de abrir el archivo suelto `file:///`. La forma más rápida si tienes Python en tu ordenador es:

```bash
git clone https://github.com/jmompean97/bancos.git
cd bancos
python3 -m http.server 8082
# Abre http://localhost:8082 en tu navegador
```

### Opción B — Abrir archivo suelto
Si sólo la vas a usar para guardar tu comparativa de forma local (en tu propio navegador sin utilizar Gist ni sincronizar con la nube):

```bash
git clone https://github.com/jmompean97/bancos.git
cd bancos
# Abre el archivo index.html haciendo doble clic o arrastrándolo a tu navegador
```

---

## 📸 Capturas

| Condiciones y bancos | Tabla comparativa |
|---|---|
| Introduce los datos de tu hipoteca y añade bancos dinámicamente | Tabla con colores: 🟢 mejor valor · 🔴 peor valor |

---

## 🎯 Funcionalidades

### 📊 Comparador de bancos

#### 🏠 Tipos de hipoteca soportados

- **Hipoteca Fija** — Bonificada y No Bonificada
  - % Interés, cuota mensual, total a pagar
  - Comisiones de amortización anticipada (tramos 0-10 años y resto)
- **Hipoteca Variable**
  - Cálculo dinámico basado en Diferencial + Euríbor.
  - Histórico de cuotas pasadas con el Euríbor real del mes.
- **Hipoteca Mixta**
  - Tramo fijo inicial configurable y tramo variable posterior.
  - Indicador visual en la tabla para marcar el cambio de tramo.

**Condiciones dinámicas por banco**: personaliza el plazo hipotecario y el % de financiación. El importe financiado se calcula automáticamente sobre el valor de compraventa/tasación del inmueble.

#### 💸 Otros gastos asociados

| Gasto | Descripción |
|---|---|
| Tasación | Coste de la valoración del inmueble |
| Registro de la propiedad | Gastos de inscripción registral |
| Notaría | Honorarios notariales |
| Gestoría | Gestión administrativa |
| Impuesto AJD | Actos Jurídicos Documentados |
| Comisión de apertura | Importe o porcentaje cobrado al inicio |
| Otros extras | Gastos adicionales personalizados |

> 🧮 El total de otros gastos se calcula automáticamente en tiempo real.
> ✅ **Gastos "Pagados"**: puedes marcar cualquier gasto como ya pagado mediante un checkbox para excluirlo automáticamente del total a pagar pendiente.

#### ⭐ Bonificaciones

Algunos bancos reducen el tipo de interés si contratas productos vinculados. MiHipoteca te permite registrar:

- ✅ **Domiciliar nómina** — reducción en % y coste (normalmente sin coste)
- ✅ **Seguro de vida** — reducción en % y coste anual
- ✅ **Seguro de hogar** — reducción en % y coste anual
- ✅ **Tarjeta de crédito** — reducción en % y coste anual

#### 📋 Tabla comparativa automática

La tabla se genera al instante y destaca:

- 🟢 **Verde** → Mejor valor entre todos los bancos
- 🔴 **Rojo** → Peor valor entre todos los bancos
- **—** → Dato no introducido (no penaliza)

---

### 📉 Módulo de Amortización

Una sección dedicada para calcular y simular tu hipoteca mes a mes con el **método francés**:

- **Fecha de firma con período parcial automático**: si firmaste a mitad de mes, la primera cuota se calcula proporcionalmente (intereses de los días reales desde la firma hasta fin de mes).
- **Integración con API del BCE**: Sincronización automática con los datos oficiales del Banco Central Europeo para obtener el Euríbor a 1 año actualizado.
- **Cálculo con Euríbor Histórico**: Recupera la media mensual del Euríbor de cada mes para calcular cuotas pasadas con precisión.
- **Simulador de amortización anticipada**: añade aportaciones extra de capital indicando el mes, importe y si deseas reducir cuota o reducir plazo.
- **Cálculo de comisiones automático**: calcula los costes que cobra el banco por amortizar anticipadamente.
- **Visualizador de cambio de tramo**: En hipotecas mixtas, la tabla resalta exactamente cuándo termina el interés fijo y empieza el variable.
- **Gráfico interactivo Chart.js**: visualiza la evolución del capital pendiente, capital amortizado e intereses acumulados con tooltips precisos.
- **Cálculo exacto de ahorros**: descubre cuánto dinero y cuántos meses exactos de hipoteca te ahorras al realizar aportaciones extraordinarias.

---

## 💾 Persistencia de datos

MiHipoteca **no usa `localStorage`** para los datos del comparador. Utiliza **IndexedDB**, la base de datos nativa del navegador:

| Característica | localStorage | IndexedDB (MiHipoteca) |
|---|---|---|
| Almacenamiento | ~5 MB | Cientos de MB |
| API | Síncrona | Asíncrona (no bloquea UI) |
| Tipo de datos | Solo strings | Objetos JS nativos |
| Transacciones | ❌ | ✅ |

**Los datos se recuperan automáticamente** al recargar la página. Verás el mensaje `✓ Sesión restaurada` en cada apertura.

### 📦 Export / Import JSON

Para **portabilidad y backup**:

- **⬆️ Importar** — Carga una sesión previa desde un archivo `.json`
- **⬇️ Exportar** — Descarga `mihipoteca-YYYY-MM-DD.json` con todos tus datos
- **🗑️ Reset** — Borra todos los datos (con confirmación)

El formato JSON exportado es legible y puede editarse manualmente si es necesario.

---

## 🗂️ Estructura del proyecto

```
bancos/
│
├── index.html      # Estructura HTML completa de la app
├── css/            # Estilos CSS divididos por dominios
│   ├── variables.css
│   ├── layout.css
│   ├── components.css
│   ├── modals.css
│   └── responsive.css
├── js/             # Lógica JS modularizada
│   ├── app.js      # Orquestador principal
│   ├── ui.js       # Renderizado de UI y eventos
│   ├── db.js       # Capa de almacenamiento en IndexedDB
│   ├── gist.js     # Cliente API de GitHub Gist
│   ├── amort.js    # Motor financiero y UI del módulo de amortización

└── README.md       # Este archivo
```

> El proyecto es **vanilla** — cero dependencias, cero bundlers, cero frameworks. Un navegador moderno es todo lo que necesitas.

---

## 🎨 Diseño

- **Light y Dark Mode** soportados con switch en tiempo real
- **Layout principal** fluido hasta 1550px para aprovechar monitores anchos
- **Glassmorphism** en tarjetas y modales (`backdrop-filter: blur`)
- **Tipografía**: Nativas del sistema operativo (`system-ui`) para máxima velocidad y **cero dependencias** de red.
- **Animaciones**: `fadeInUp` en secciones, `cardIn` en tarjetas de banco, rebote en modal
- **Colores por banco**: 6 paletas de gradiente únicas, asignadas automáticamente
- **Responsive**: adaptado a móvil, tablet y escritorio


---

## 🌐 Despliegue en GitHub Pages

1. Sube el repositorio a GitHub
2. Ve a **Settings → Pages**
3. En *Source*, selecciona `main` branch y carpeta `/root`
4. Pulsa **Save** — en ~30 segundos tienes tu URL pública

```
https://jmompean97.github.io/bancos/
```

> ⚠️ **Nota sobre persistencia en Pages:** IndexedDB funciona correctamente en GitHub Pages, pero los datos se almacenan **localmente en cada navegador**. Si usas la app en otro dispositivo, usa el botón **Exportar** para llevarte los datos y **Importar** en el nuevo.

---

## 🔭 Roadmap / Ideas futuras

- [x] **Sincronización via GitHub Gist** — guarda el JSON en un Gist privado tuyo y sincroniza automáticamente usando tu Personal Access Token
- [x] **Calculadora de cuota y Amortización** — calcula la cuota mensual automáticamente, y visualiza la amortización mes a mes y amortizaciones extra.
- [x] **Modo comparación visual con gráficos** — gráfico dinámico y responsivo con Chart.js para ver la amortización.
- [x] **Cuota parcial por firma a mitad de mes** — cálculo automático proporcional de la primera cuota según el día de firma.
- [ ] **Ahorro real con bonificaciones** — calcula si compensa contratar cada producto vinculado (reducción de interés vs coste anual del seguro)
- [ ] **Compartir via URL** — codifica el estado en la URL para compartir tu comparativa sin exportar ficheros

---

## 🤝 Contribuir

¿Tienes ideas o encuentras un bug? Las PRs y los issues son bienvenidos.

1. Haz fork del repositorio
2. Crea una rama: `git checkout -b feature/mi-mejora`
3. Commitea tus cambios: `git commit -m 'feat: añadir calculadora de cuota'`
4. Pushea: `git push origin feature/mi-mejora`
5. Abre una Pull Request

---

## 📄 Licencia

Distribuido bajo licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

<div align="center">

&copy; 2026 **[Jorge Mompeán Cabezas](https://www.linkedin.com/in/jorgemompean/)**. Todos los derechos reservados.

Hecho con ☕ y muchas horas comparando hipotecas para la comunidad.

**[⬆ Volver arriba](#-mihipoteca)**

</div>
