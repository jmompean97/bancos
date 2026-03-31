<div align="center">

# 🏦 BancoComp

### Comparador de hipotecas inteligente

**Compara condiciones hipotecarias de múltiples bancos de forma visual, rápida y sin perder tus datos.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/IndexedDB_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## ✨ ¿Qué es BancoComp?

Cuando pides una hipoteca, cada banco te da una oferta diferente con cientos de variables: tipos de interés, cuotas mensuales, gastos de formalización, bonificaciones por contratar seguros... **compararlo a mano en papel o Excel es un caos.**

**BancoComp** es una app web que te permite introducir las condiciones de cada banco, previsualizar todos los datos en tarjetas y generar automáticamente una **tabla comparativa completa** donde los mejores valores aparecen en verde y los peores en rojo — de un vistazo.

Sin registro. Sin servidor. Sin instalar nada. Abre el archivo y listo.

---

## 🚀 Demo rápida

> Puedes usar la app directamente abriendo `index.html` en tu navegador, o sirviéndola desde un servidor local para activar opciones avanzadas (sincronización).

### Opción A — Servidor Local (Recomendado para Gist Sync)
Si vas a utilizar la opción de sincronización en la nube mediante **GitHub Gist**, por razones de seguridad de tu navegador (políticas CORS), necesitas levantar la app desde un servidor web en lugar de abrir el archivo suelto `file:///`. La forma más rápida si tienes Python en tu ordenador es:

```bash
git clone https://github.com/jmompean97/bancos.git
cd bancos
python3 -m http.server 8080
# Abre http://localhost:8080 en tu navegador
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

### 🏠 Tipos de hipoteca soportados

- **Hipoteca Fija** — Bonificada y No Bonificada
  - % Interés, cuota mensual, total a pagar
  - Comisiones de amortización anticipada (tramos 0-10 años y resto)
  - **Condiciones dinámicas por banco**: personaliza el plazo hipotecario y el % de financiación. El importe financiado se calcula automáticamente sobre el valor de compraventa/tasación del inmueble.



### 💸 Otros gastos asociados

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
> ✅ **Gastos "Pagados"**: puedes marcar cualquier gasto como ya pagado mediante un checkbox para excluirlo  automáticamente del total a pagar pendiente.

### ⭐ Bonificaciones

Algunos bancos reducen el tipo de interés si contratas productos vinculados. BancoComp te permite registrar:

- ✅ **Domiciliar nómina** — reducción en % y coste (normalmente sin coste)
- ✅ **Seguro de vida** — reducción en % y coste anual
- ✅ **Seguro de hogar** — reducción en % y coste anual
- ✅ **Tarjeta de crédito** — reducción en % y coste anual

### 📊 Tabla comparativa automática

La tabla se genera al instante y destaca:

- 🟢 **Verde** → Mejor valor entre todos los bancos
- 🔴 **Rojo** → Peor valor entre todos los bancos
- **—** → Dato no introducido (no penaliza)

---

## 💾 Persistencia de datos

BancoComp **no usa `localStorage`**. Utiliza **IndexedDB**, la base de datos nativa del navegador:

| Característica | localStorage | IndexedDB (BancoComp) |
|---|---|---|
| Almacenamiento | ~5 MB | Cientos de MB |
| API | Síncrona | Asíncrona (no bloquea UI) |
| Tipo de datos | Solo strings | Objetos JS nativos |
| Transacciones | ❌ | ✅ |

**Los datos se recuperan automáticamente** al recargar la página. Verás el mensaje `✓ Sesión restaurada` en cada apertura.

### 📦 Export / Import JSON

Para **portabilidad y backup**:

- **⬆️ Importar** — Carga una sesión previa desde un archivo `.json`
- **⬇️ Exportar** — Descarga `bancocomp-YYYY-MM-DD.json` con todos tus datos
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

└── README.md       # Este archivo
```

> El proyecto es **vanilla** — cero dependencias, cero bundlers, cero frameworks. Un navegador moderno es todo lo que necesitas.

---

## 🎨 Diseño

- **Light y Dark Mode** soportados con switch en tiempo real
- **Layout principal** fluido hasta 1550px para aprovechar monitores anchos
- **Glassmorphism** en tarjetas y modales (`backdrop-filter: blur`)
- **Tipografía**: Inter + Space Grotesk (Google Fonts)
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
- [ ] **Modo comparación visual con gráficos** — barras o radar chart para ver rápidamente qué banco gana en cada categoría
- [ ] **Calculadora de cuota** — calcula la cuota mensual automáticamente dado importe, plazo y tipo de interés
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

&copy; 2026 **[Jorge Mompeán](https://github.com/jmompean97)**. Todos los derechos reservados.

Hecho con ☕ y muchas horas comparando hipotecas para la comunidad.

**[⬆ Volver arriba](#-bancocomp)**

</div>
