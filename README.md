# Curvebook

Drag the handles, watch it move, copy the timing function.

Curvebook is a small tool for designers and developers who work with motion. Shape a cubic-bezier curve, preview it on position, scale, rotate and opacity, then copy it as CSS, a CSS variable, a Web Animations call or a Tailwind config.

**Live demo:** https://theayoboyede.github.io/Curvebook/

## Features

- **Curve editor.** Two draggable handles on a graph, plus number fields for x1, y1, x2 and y2. Handles are keyboard friendly: focus one and use the arrow keys, or hold Shift for bigger steps.
- **Nine presets.** Linear, Ease, Ease in, Ease out, Ease in out, Out quint, In out cubic, and two overshoot curves, Out back and In back.
- **Live preview.** Position, scale, rotate and opacity all animate with your curve. A faint ball moves at plain `linear` speed beside the position ball so you can see what your curve adds.
- **Playback controls.** Adjustable duration (200 to 2000 ms), a loop option, and a Replay button. Press Space to replay.
- **Export.** Copy the curve as CSS, a CSS variable, JavaScript (Web Animations API) or a Tailwind config.
- **Saved curves.** Favourites are kept in the browser with `localStorage`.
- **Shareable links.** The current curve is stored in the page address, for example `#0.34,1.56,0.64,1`, so you can send it to someone.
- **Themes and layout.** Light and dark themes follow the system setting, and the layout is responsive.

## Tech stack

- HTML, CSS and vanilla JavaScript, with no frameworks, dependencies or build step.
- Google Fonts (Bricolage Grotesque, DM Mono and Hanken Grotesk). Without internet access the page uses system fonts.
- Project files: `index.html`, `styles.css` and `script.js`.

## Run it

Clone or download the repo, keep the three files in one folder, and open `index.html` in a browser.

To host it, turn on GitHub Pages in the repo settings and deploy from the main branch.

## How it works

- A `state` object holds the curve, duration, loop setting, export format and saved curves. Each change calls `render()` to update the interface.
- The graph is an SVG. Dragging converts pointer position into curve values through the SVG's own coordinate system, rounded to two decimals.
- The preview uses the Web Animations API with `easing: "cubic-bezier(...)"`, so the browser runs the same timing function you export.
- The dot that travels along the curve while it plays uses a small cubic-bezier solver (Newton's method with a bisection fallback) to find progress for each moment in time.
- The x values are limited to 0 to 1, as CSS requires. The y values can go from -0.6 to 1.6 so overshoot curves fit.

## Customize

- Add a preset by adding an entry to the `PRESETS` array in `script.js`.
- Change the starting curve with `curve` in `state`.
- Adjust colours and fonts in the variables at the top of `styles.css`.

## Author

Built by Ayoboyede. [GitHub](https://github.com/theayoboyede) · [Instagram](https://instagram.com/robinswago)
