# Peeky — Landing Page

The landing page for [Peeky](https://github.com/danielbusnz-lgtm/Peeky), a
voice-controlled AI cursor for macOS.

Live at **[countdown.si9num.com](https://countdown.si9num.com)**.

A simple static page: a hero, a download button, and a few example commands.
No build step and no framework, just HTML, CSS, and a little JavaScript.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — the page
- `style.css` — styles
- `script.js` — marquee loop, email form, trailing cursor, and GitHub star count
- `cursor.png` — custom cursor image
- `CNAME` — custom domain for GitHub Pages

## Deploy

Hosted on GitHub Pages. Pushing to the default branch publishes the site.
