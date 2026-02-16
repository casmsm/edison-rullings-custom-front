# Edison Rullings custom front

* You keep a **local copy** of the big proxied `edisonrulings.json`
* The UI stays snappy because **all parsing + indexing happens in a Web Worker**
* The page only renders:

  * top N search results
  * one selected card detail

Please support MikaMika's ko-fi https://ko-fi.com/mikamika who maintains all this data. I just did this for myself.

## Project structure (v1)

```
edison-rulings-custom-front/
  index.html
  css/
    app.css
  js/
    app.js
    searchWorker.js
  data/
    edisonrulings.json <-- your local copy of the proxied big JSON
  scripts/
    update-pack.mjs <-- optional helper to refresh data/edisonrulings.json
```

## How to run locally

1. Put your `edisonrulings.json` into `data/edisonrulings.json`
2. Run a static server (don’t use `file://`):

```bash
python -m http.server 5173
```

3. Open `http://localhost:5173`

---

## Optional: `scripts/update-pack.mjs` (refresh your local copy)

Run:

```bash
SOURCE_URL="https://edisonformat.net/data/json/EdisonCards.json" node scripts/update-pack.mjs
```

---