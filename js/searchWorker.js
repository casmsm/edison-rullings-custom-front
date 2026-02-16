let ready = false;

let cards = [];             // normalized cards
let cardsById = new Map();  // id -> card

self.onmessage = async (e) => {
    const { type, payload } = e.data || {};
    try {
        if (type === "init") {
            const { packUrl } = payload;
            const t0 = performance.now();

            const arr = await loadPack(packUrl);
            buildIndex(arr);

            ready = true;
            const tookMs = Math.round(performance.now() - t0);
            self.postMessage({ type: "ready", payload: { count: cards.length, tookMs } });
            return;
        }

        if (type === "search") {
            if (!ready) return;
            const { q, limit = 50, includeText = false } = payload;
            const results = searchNameAndText(q, limit, includeText);
            self.postMessage({ type: "searchResults", payload: { q, results } });
            return;
        }

        if (type === "get") {
            if (!ready) return;
            const id = Number(payload?.id);
            const card = cardsById.get(id) || null;
            self.postMessage({ type: "card", payload: { card } });
            return;
        }

        if (type === "refreshRaw") {
            const id = Number(payload?.id);
            const card = await fetchAndNormalizeRaw(id);
            if (card) {
                cardsById.set(card.id, card);
                const idx = cards.findIndex((c) => c.id === card.id);
                if (idx !== -1) cards[idx] = card;
            }
            self.postMessage({ type: "card", payload: { card: card || null, refreshed: true } });
            return;
        }
    } catch (err) {
        self.postMessage({ type: "error", payload: { message: err?.message || String(err) } });
    }
};

async function loadPack(packUrl) {
    const res = await fetch(packUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load pack: ${res.status} ${res.statusText}`);

    const json = await res.json();

    // supports: [ ...cards ] OR { cards:[...] } OR { "473...": {...}, ... }
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.cards)) return json.cards;
    if (json && typeof json === "object") return Object.values(json);

    throw new Error("Pack JSON format not recognized (expected array or object).");
}

function buildIndex(arr) {
    cards = [];
    cardsById = new Map();

    for (const raw of arr) {
        const card = normalizeCard(raw);
        if (!card) continue;
        cards.push(card);
        cardsById.set(card.id, card);
    }
}

function normalizeCard(raw) {
    const id = Number(raw?.id ?? raw?.Id);
    const name = String(raw?.Name ?? raw?.name ?? "").trim();
    if (!id || !name) return null;

    const type = String(raw?.Type ?? raw?.type ?? "").trim();
    const extra = String(raw?.Extra ?? raw?.extra ?? "").trim();
    const attribute = String(raw?.Attribute ?? raw?.attribute ?? "").trim();

    const text = String(raw?.Text ?? raw?.text ?? "").trim();

    const atkRaw = raw?.Atk ?? raw?.atk;
    const defRaw = raw?.Def ?? raw?.def;
    const lvlRaw = raw?.Level ?? raw?.level;

    const rulingsEdison = pickEdisonOrString(raw?.Rulings);
    const psctEdison = pickEdisonOrString(raw?.PSCT);

    return {
        id,
        name,
        nameLower: name.toLowerCase(),

        type,
        extra,
        attribute,

        text,
        textLower: text.toLowerCase(),

        atk: atkRaw != null && atkRaw !== "" ? Number(atkRaw) : null,
        def: defRaw != null && defRaw !== "" ? Number(defRaw) : null,
        level: lvlRaw != null && lvlRaw !== "" ? Number(lvlRaw) : null,

        // For display
        rulingsEdison: rulingsEdison || "",
        psctEdison: psctEdison || "",

        rawUrl: `https://raw.githubusercontent.com/MikaMikaDE/mikaRulings/main/cards/${id}.json`,
        // Please support MikaMika @ https://ko-fi.com/mikamika
    };
}

function pickEdisonOrString(field) {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") return field.Edison ?? "";
    return "";
}

// Search: Name only (default). Optional: include Text. Never searches rulings/psct.
function searchNameAndText(query, limit, includeText) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);

    const hits = [];
    for (const c of cards) {
        let score = 0;
        let hit = "name";

        if (c.nameLower === q) score = 1000;
        else if (c.nameLower.startsWith(q)) score = 800;
        else if (tokens.every((t) => c.nameLower.includes(t))) score = 500;
        else if (includeText && tokens.every((t) => c.textLower.includes(t))) {
            score = 200;
            hit = "text";
        }

        if (score) hits.push({ c, score, hit });
    }

    hits.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
    return hits.slice(0, limit).map(({ c, hit }) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        extra: c.extra,
        attribute: c.attribute,
        hit,
    }));
}

async function fetchAndNormalizeRaw(id) {
    const url = `https://raw.githubusercontent.com/MikaMikaDE/mikaRulings/main/cards/${id}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Raw fetch failed: ${res.status} ${res.statusText}`);
    const raw = await res.json();
    return normalizeCard(raw);
}