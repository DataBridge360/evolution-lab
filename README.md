# Evolution Chemical SRL — Sitio Web

Sitio web institucional de **Evolution Chemical S.R.L.**, laboratorio de análisis industriales con más de 25 años de experiencia en la industria petrolera de Neuquén, Argentina.

Construido con [Astro](https://astro.build).

---

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- npm v9 o superior (incluido con Node.js)

---

## Instalación y uso

### 1. Clonar el repositorio

```bash
git clone git@github.com:DataBridge360/evolution-lab.git
cd evolution-lab
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar el servidor de desarrollo

```bash
npm run dev
```

El sitio estará disponible en [http://localhost:4321](http://localhost:4321).

---

## Comandos disponibles

| Comando           | Descripción                                        |
| :---------------- | :------------------------------------------------- |
| `npm install`     | Instala las dependencias del proyecto              |
| `npm run dev`     | Inicia el servidor local en `localhost:4321`       |
| `npm run build`   | Genera el sitio de producción en `./dist/`         |
| `npm run preview` | Previsualiza el build antes de deployar            |

---

## Estructura del proyecto

```
/
├── public/
│   └── assets/
│       └── images/          # Imágenes y logos
├── src/
│   ├── components/
│   │   ├── Hero.astro        # Navbar + hero con animación
│   │   ├── QuienesSomos.astro
│   │   ├── Servicios.astro
│   │   ├── Contacto.astro
│   │   └── Footer.astro
│   ├── layouts/
│   │   └── Layout.astro      # Layout global + variables CSS
│   ├── pages/
│   │   ├── index.astro       # Página principal
│   │   └── login.astro       # Página de inicio de sesión
│   └── utils/
│       └── vapourText.ts     # Animación de texto en canvas
├── .gitignore
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## Tecnologías

- **Astro 6** — framework principal
- **TypeScript** — tipado estático
- **CSS nativo** — sin frameworks de estilos externos
- **Netlify Forms** — manejo del formulario de contacto
