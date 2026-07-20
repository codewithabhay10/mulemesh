# MuleMesh 🕸️

**Detect money-mule rings in a cross-border payment network — India UPI ↔ Singapore PayNow.**

MuleMesh generates a synthetic transaction graph (~277 accounts, ~640 transfers),
injects three classic laundering typologies with ground-truth labels, detects them
with explainable graph analytics, and renders everything in two live views you can
screen-record for a 60-second pitch:

- **🛰 Corridor** (default) — a Google-Earth-style satellite map with Indian
  accounts scattered over real metros, Singapore accounts on the island, the
  India and Singapore flags pinned above/below, and glowing arcs that flow
  **one-way, India → Singapore** as the money moves.
- **◉ Network** — the classic force-directed graph, best for reading the internal
  structure of each ring (fan-in/fan-out, chains, smurf spokes).

Toggle between them with the pill at the bottom of the screen; Play, detection,
and the ring dossier work identically in both.

> 100% synthetic data. No real accounts, no database — the whole world lives in memory.

---

## Quick start

**Windows (one command):**

```powershell
cd mulemesh
.\run.ps1
```

**macOS / Linux (one command):**

```bash
cd mulemesh
./run.sh
```

The script creates a venv, installs everything, starts the API on `:8000`, and
opens the UI at **http://localhost:5173**.

**Manual (two short commands):**

```bash
# terminal 1 — backend
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --port 8000

# terminal 2 — frontend
cd frontend && npm install && npm run dev
```

**Seed script** (regenerate the dataset, print detection summary, dump `backend/data.json`):

```bash
python backend/seed.py           # default seed 7
python backend/seed.py 42        # any other seed
```

---

## The 60-second demo script

1. **App loads** — the satellite Corridor view: calm teal account clusters over
   India, the Singapore cluster below, and gold arcs of legitimate cross-border
   remittances drifting India → Singapore. (Switch to **◉ Network** any time.)
2. **Hit ▶ Play** — six hours of transactions stream in over ~15 seconds.
   Three clusters assemble live and **flash red** as each ring completes:
   a fan-in/fan-out hub, a layering chain, and a smurfing network.
   The top bar counts rings and flagged value as they land.
3. **Click the biggest red hub** (labelled `HUB`, strongest glow).
4. **The side panel opens** — risk dial, typology, the exact rules that fired
   (with weights and evidence), member accounts, and an auto-generated
   **Suspicious Activity Report**. Optionally hit **✦ Polish with Claude** to
   rewrite it in regulator prose.

---

## What gets injected (ground truth)

| Ring | Typology | Shape | Corridor |
|---|---|---|---|
| RING-001 | Fan-in / Fan-out Mule Hub | 14 victims → 1 hub → 8 dispersal accounts (5 in SG) | IN → SG |
| RING-002 | Layering Chain | ₹9.4L hopping A→B→C→D→E→F in minutes, last 2 hops in SG | IN → SG |
| RING-003 | Smurfing / Structuring | 19 transfers of ₹47.5–49.9k (under the ₹50k threshold) → 10 smurfs → 1 SG aggregator | IN → SG |

## How detection works (no black box)

Per-node graph features → simple weighted rules → 0–100 risk score where **every
point is attributable to a named rule**:

- **Features:** in/out degree (unique counterparties), fan-in/fan-out ratio,
  betweenness centrality, transaction velocity (max txs per 30-min window),
  pass-through ratio + holding time, sub-threshold band counts, cross-border flow.
- **Rules (weight):** fan-in/fan-out hub (40), sub-threshold structuring (45),
  rapid pass-through layering (50), smurf relay (30), cross-border sink (35),
  large cross-border outflow (20), velocity (15), concentrated fan-in (15),
  betweenness (10).
- **Louvain community detection** groups the graph; flagged nodes are expanded
  along stream-phase money flow into rings, and ring risk propagates to
  unflagged members (tagged `COMMUNITY_RISK` so the propagation is visible too).
- **Precision note:** the UI reports precision & recall of detected ring members
  against the injected ground-truth labels (1.0 / 1.0 on the default seed).

## SAR generation

Default is a deterministic template filled from the ring's data (case id,
accounts, pattern, amounts, corridor, rule trace). The **✦ Polish with Claude**
button POSTs `{"llm": true}` and the backend calls the Anthropic API
(`claude-opus-4-8`) to rewrite it in formal regulator prose:

```bash
# optional — only needed for the polish button
export ANTHROPIC_API_KEY=sk-ant-...      # PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
```

No key (or any API failure) → the template is served unchanged and the UI says so.
The demo never breaks.

## API

| Endpoint | Description |
|---|---|
| `GET /api/graph` | nodes, links, rings, stats, playback window |
| `GET /api/rings` | detected rings with rule traces |
| `GET /api/stats` | counters + precision/recall vs ground truth |
| `POST /api/sar/{ring_id}` | `{"llm": false}` template · `{"llm": true}` Claude rewrite |

## Stack

FastAPI + NetworkX (in-memory graph, Louvain, betweenness) · React + Vite ·
react-force-graph-2d for the Network view · Leaflet + Esri World Imagery
(free satellite tiles, no API key) with a synced canvas overlay for the Corridor
view · optional Anthropic API for SAR prose.

> The Corridor view streams satellite tiles from Esri, so it needs internet. If
> tiles are unavailable the map falls back to a dark ocean backdrop and the arcs,
> nodes, and flags still render — nothing else in the demo depends on the network.

## Production-ish single process

```bash
cd frontend && npm run build          # writes frontend/dist
python -m uvicorn backend.app.main:app --port 8000
# → the API now serves the built UI at http://localhost:8000
```
