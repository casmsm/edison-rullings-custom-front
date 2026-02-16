// Config
const PACK_URL = "../data/edisonrulings.json";
const MAX_RESULTS = 50;

// DOM
const el = {
    // Search / header
    q: document.getElementById("q"),
    includeText: document.getElementById("includeText"),
    clear: document.getElementById("clear"),
    status: document.getElementById("status"),
    resultCount: document.getElementById("resultCount"),

    // Results panel
    results: document.getElementById("results"),
    empty: document.getElementById("empty"),

    // Detail panel
    detailEmpty: document.getElementById("detailEmpty"),
    detail: document.getElementById("detail"),
    cardImg: document.getElementById("cardImg"),
    cardName: document.getElementById("cardName"),
    cardMeta: document.getElementById("cardMeta"),
    cardText: document.getElementById("cardText"),
    rulings: document.getElementById("rulings"),
    psct: document.getElementById("psct"),
    rawLink: document.getElementById("rawLink"),
    refresh: document.getElementById("refresh"),

    // Mobile results sheet
    toggleResults: document.getElementById("toggleResults"),
    backdrop: document.getElementById("backdrop"),
};

// Header height syncing
const headerEl = document.querySelector(".header");
function syncHeaderH() {
    if (!headerEl) return;
    const h = Math.ceil(headerEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-h", `${h}px`);
}

syncHeaderH();

if (headerEl && "ResizeObserver" in window) {
    new ResizeObserver(syncHeaderH).observe(headerEl);
} else {
    window.addEventListener("resize", () => syncHeaderH());
}

// State
const state = {
    ready: false,
    q: "",
    includeText: false,
    results: [],
    activeIndex: -1,
    activeId: null,
};

// Mobile sheet helpers
const mqMobile = window.matchMedia("(max-width: 980px), (orientation: portrait) and (max-width: 1100px)");

function openResultsSheet() {
    if (!mqMobile.matches) return;
    document.body.classList.add("show-results");
    el.toggleResults?.setAttribute("aria-expanded", "true");
}

function closeResultsSheet() {
    document.body.classList.remove("show-results");
    el.toggleResults?.setAttribute("aria-expanded", "false");
}

function toggleResultsSheet() {
    if (!mqMobile.matches) return;
    if (document.body.classList.contains("show-results")) closeResultsSheet();
    else openResultsSheet();
}

// UI helpers
function updateClearVisibility() {
    const has = el.q.value.trim().length > 0;
    el.clear.classList.toggle("show", has);
}

// Worker
const worker = new Worker("./js/searchWorker.js", { type: "module" });

worker.onmessage = (e) => {
    const { type, payload } = e.data || {};

    switch (type) {
        case "ready": {
            state.ready = true;
            const { count, tookMs } = payload;

            el.status.textContent = `Ready: ${count.toLocaleString()} cards (indexed in ${tookMs}ms)`;
            el.status.classList.add("ok");

            el.q.disabled = false;
            el.q.focus();
            updateClearVisibility();
            break;
        }

        case "searchResults": {
            const { results } = payload;

            state.results = results;
            state.activeIndex = results.length ? 0 : -1;
            state.activeId = results.length ? results[0].id : null;

            renderResults(state.results, state.q);
            el.resultCount.textContent = String(results.length);

            if (!state.q.trim()) {
                el.empty.style.display = "block";
                el.empty.textContent = "Type in the search box to begin.";
            } else {
                el.empty.style.display = results.length ? "none" : "block";
                el.empty.textContent = results.length ? "" : "No matches.";
            }
            break;
        }

        case "card": {
            const { card, refreshed } = payload || {};
            if (!card) {
                showDetailEmpty("No card data found.");
                break;
            }
            renderDetail(card, refreshed);
            break;
        }

        case "error": {
            el.status.textContent = `Error: ${payload?.message ?? "Unknown error"}`;
            el.status.classList.add("bad");
            break;
        }
    }
};

// Search
const debouncedSearch = debounce(() => {
    if (!state.ready) return;
    worker.postMessage({
        type: "search",
        payload: {
            q: state.q,
            limit: MAX_RESULTS,
            includeText: state.includeText,
        },
    });
}, 40);

// Event wiring

// Init worker
el.q.disabled = true;
worker.postMessage({ type: "init", payload: { packUrl: PACK_URL } });

// Mobile sheet controls
el.toggleResults?.addEventListener("click", toggleResultsSheet);
el.backdrop?.addEventListener("click", closeResultsSheet);

// Search input interactions
el.q.addEventListener("focus", () => {
    if (el.q.value.trim()) openResultsSheet();
});

el.q.addEventListener("input", () => {
    updateClearVisibility();

    state.q = el.q.value;
    debouncedSearch();

    if (mqMobile.matches && el.q.value.trim()) openResultsSheet();
});

el.includeText.addEventListener("change", () => {
    state.includeText = Boolean(el.includeText.checked);
    debouncedSearch();
});

// Keyboard navigation
el.q.addEventListener("keydown", (e) => {
    // No results
    if (!state.results.length) {
        if (e.key === "Escape") {
            closeResultsSheet();
            clearSearch();
        }
        return;
    }

    switch (e.key) {
        case "ArrowDown":
            e.preventDefault();
            setActiveIndex(Math.min(state.activeIndex + 1, state.results.length - 1));
            break;

        case "ArrowUp":
            e.preventDefault();
            setActiveIndex(Math.max(state.activeIndex - 1, 0));
            break;

        case "Enter":
            e.preventDefault();
            openActive();
            break;

        case "Escape":
            e.preventDefault();
            closeResultsSheet();
            clearSearch();
            break;
    }
});

// Clear button
el.clear.addEventListener("click", () => {
    closeResultsSheet();
    clearSearch();
});

// Click results (event delegation)
el.results.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;

    const id = Number(li.dataset.id);
    const idx = state.results.findIndex((r) => r.id === id);

    if (idx !== -1) {
        setActiveIndex(idx);
        openActive();
    }
});

// Refresh from GitHub raw (optional)
el.refresh.addEventListener("click", () => {
    if (!state.activeId) return;

    el.status.textContent = "Refreshing from GitHub raw…";
    el.status.classList.remove("ok", "bad");

    worker.postMessage({ type: "refreshRaw", payload: { id: state.activeId } });
});

// Actions
function clearSearch() {
    state.q = "";
    el.q.value = "";

    state.results = [];
    state.activeIndex = -1;
    state.activeId = null;

    el.results.textContent = "";
    el.resultCount.textContent = "0";

    el.empty.style.display = "block";
    el.empty.textContent = "Type in the search box to begin.";

    showDetailEmpty("Select a card to see its details.");

    updateClearVisibility();
    el.q.focus();
}

function setActiveIndex(nextIndex) {
    state.activeIndex = nextIndex;
    state.activeId = state.results[nextIndex]?.id ?? null;
    updateActiveRow();
}

function openActive() {
    const r = state.results[state.activeIndex];
    if (!r) return;

    state.activeId = r.id;
    worker.postMessage({ type: "get", payload: { id: r.id } });

    if (mqMobile.matches) closeResultsSheet();
}

// Rendering
function updateActiveRow() {
    const children = el.results.children;
    for (let i = 0; i < children.length; i++) {
        const li = children[i];
        const isActive = i === state.activeIndex;

        li.classList.toggle("active", isActive);
        li.setAttribute("aria-selected", isActive ? "true" : "false");

        if (isActive) li.scrollIntoView({ block: "nearest" });
    }
}

function renderResults(results, q) {
    el.results.textContent = "";
    const frag = document.createDocumentFragment();

    for (let i = 0; i < results.length; i++) {
        const r = results[i];

        const li = document.createElement("li");
        li.className = "result";
        li.dataset.id = String(r.id);
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === state.activeIndex ? "true" : "false");
        if (i === state.activeIndex) li.classList.add("active");

        const top = document.createElement("div");
        top.className = "result-top";
        top.append(renderHighlighted(r.name, q));

        const meta = document.createElement("div");
        meta.className = "result-meta";
        meta.textContent = [
            r.attribute,
            r.type,
            r.extra,
            r.hit === "text" ? "match: Text" : "",
        ]
            .filter(Boolean)
            .join(" • ");

        li.append(top, meta);
        frag.append(li);
    }

    el.results.append(frag);
    updateActiveRow();
}

function renderDetail(card, refreshed = false) {
    el.detailEmpty.hidden = true;
    el.detail.hidden = false;

    el.cardName.textContent = card.name;
    el.cardMeta.textContent = formatMeta(card);

    setCardImage(el.cardImg, card.id, card.name);

    el.cardText.textContent = card.text?.trim() ? card.text : "No card text found.";
    el.rulings.textContent = card.rulingsEdison?.trim() ? card.rulingsEdison : "No Edison rulings found.";
    el.psct.textContent = card.psctEdison?.trim() ? card.psctEdison : "No Edison PSCT found.";

    el.rawLink.href = card.rawUrl;

    if (refreshed) {
        el.status.textContent = "Refreshed from GitHub raw.";
        el.status.classList.add("ok");
    }
}

function showDetailEmpty(text) {
    el.detail.hidden = true;
    el.detailEmpty.hidden = false;
    el.detailEmpty.textContent = text;
}

// Card helpers
function setCardImage(imgEl, id, name) {
    const urls = [
        `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`,
        `https://images.ygoprodeck.com/images/cards/${id}.jpg`,
        `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`,
    ];

    imgEl.alt = `${name} card image`;
    imgEl.dataset.fallbackIndex = "0";
    imgEl.dataset.fallbackUrls = JSON.stringify(urls);
    imgEl.classList.remove("img-hidden");

    imgEl.onerror = () => {
        const list = JSON.parse(imgEl.dataset.fallbackUrls || "[]");
        let idx = Number(imgEl.dataset.fallbackIndex || "0") + 1;

        if (idx >= list.length) {
            imgEl.classList.add("img-hidden");
            imgEl.onerror = null;
            return;
        }

        imgEl.dataset.fallbackIndex = String(idx);
        imgEl.src = list[idx];
    };

    imgEl.src = urls[0];
}

function formatMeta(card) {
    const parts = [];
    if (card.id) parts.push(`#${card.id}`);

    const typeBits = [card.attribute, card.type, card.extra].filter(Boolean).join(" • ");
    if (typeBits) parts.push(typeBits);

    const stats = [];
    if (card.level != null) stats.push(`LV${card.level}`);

    const atkDef = [
        card.atk != null ? `ATK ${card.atk}` : "",
        card.def != null ? `DEF ${card.def}` : "",
    ]
        .filter(Boolean)
        .join(" / ");

    if (atkDef) stats.push(atkDef);
    if (stats.length) parts.push(stats.join(" • "));

    return parts.join(" — ");
}

function renderHighlighted(text, query) {
    const q = String(query ?? "").trim();
    if (!q) return document.createTextNode(text);

    const hay = text.toLowerCase();
    const needle = q.toLowerCase();
    const idx = hay.indexOf(needle);
    if (idx === -1) return document.createTextNode(text);

    const frag = document.createDocumentFragment();
    frag.append(text.slice(0, idx));

    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + q.length);
    frag.append(mark);

    frag.append(text.slice(idx + q.length));
    return frag;
}

// Utilities
function debounce(fn, ms) {
    let t = null;
    return (...args) => {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}