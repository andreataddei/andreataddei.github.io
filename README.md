# andreataddei.github.io

```
       Mission Control // portfolio di Andrea Taddei
        ─────────────────────────────────────────────
                   /\
                  /  \
                 /    \
                /      \
               /  ANDREA \
              /  TADDEI   \
             /____________\
            |   LAUNCH     |
            |   SEQUENCE   |
            |______________|
            |  ▓▓      ▓▓  |
            |  ▓▓▓▓▓▓▓▓▓▓  |
             \_____________/
                |  APOGEE  |
                |   400km  |
               /|__________|\
              /_|  STAGE 2  |_\
                //|        |\\
               // |  NOZZLE | \\
              //  |__________|  \\
             ///________________\\\
                    :      :
                    :      :
              .   *   :    :   *   .
           *     .    :    :    .     *
              .  ___   :  :   ___  .
             *  /   \   :  :  /   \  *
               | (o) |  :  : | (o) |
                \___/   :  :  \___/
                        :  :
                   *    :  :    .
              .      .  :  :  .      *
```

> Portfolio personale a tema **mission control**: Terra 3D reale,
> cielo astronomico, satelliti in orbita propagati dai TLE.

## Struttura del volo

```
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │  HOME   │──▶│  FOCUS  │──▶│  WORK   │──▶│ CONTACT │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘
        │             │            │             │
        └─────────────┴─────┬──────┴─────────────┘
                            ▼
                    ┌──────────────┐
                    │  main.js     │  un solo script per tutte
                    │  style.css   │  un solo foglio di stile
                    └──────────────┘
```

## Payload a bordo

```
  ░░ TERRA ░░      Texture NASA 2048px, rotazione siderale reale,
                  rilievo calcolato per pixel (bump shading)

  ★ CIELO ★        20 costellazioni con stelle vere (RA/Dec J2000):
                  Orione, Orsa Maggiore, Cassiopeia, Cigno, Leo...
                  nomi delle stelle: Sirius, Vega, Polaris...

  ○ SATELLITI ○    24 oggetti reali propagati dai TLE di CelesTrak:
                  ISS, Sentinel-2, Landsat, Terra, Aqua, Starlink
                  time-lapse 240x, aggiornamento TLE settimanale

  ▓ BACKEND ▓      Zero. Solo HTML/CSS/JS statico su GitHub Pages.
                  Nessuna dipendenza, nessun framework, 100% client.
```

## Telemetria (stack)

```
   HTML ──────┐
   CSS  ──────┤     canvas 2D
   JS   ──────┼──▶ ▓▓▓▓▓▓▓▓▓▓ ──▶ 60 fps
   TLE  ──────┤     rendering
   base64 ────┘     engine
```

- **Rendering**: Canvas 2D, nessuna libreria grafica
- **Propagazione orbitale**: kepleriana a 2 corpi dal TLE
- **Cielo**: proiezione da ~45°N, deriva siderale
- **Deploy**: push su `main` → GitHub Pages

## Controlli di missione

```
   $ git clone https://github.com/andreataddei/andreataddei.github.io
   $ cd andreataddei.github.io
   $ python3 -m http.server 8000    # o aprilo e basta: è statico
```

Nessuna build, nessun `npm install`. Se funziona nel browser, funziona.

---

```
                     .-~~~-.
  .- ~ ~-(       )_ _
 /                     ~ -.|        T+00:00:00 — liftoff
|                          \        Status: NOMINAL
 \                         .'       Next window: quando vuoi
   ~- . _ / - ~                Tutto il resto: https://andreataddei.github.io
```

© Andrea Taddei — XR · AI · Space & Geospatial Data
