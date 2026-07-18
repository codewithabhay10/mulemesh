"""MuleMesh API — in-memory synthetic graph + detection, no database."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .detection import analyze
from .generator import generate
from .sar import build_template_sar, polish_with_claude

app = FastAPI(title="MuleMesh", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------------------------------------------------------------------- #
# Build the world once at startup (deterministic seed)
# ---------------------------------------------------------------------- #
DATA = generate()
RESULT = analyze(DATA)
RINGS_BY_ID = {r["id"]: r for r in RESULT["rings"]}

_ring_of_node = {}
for _r in RESULT["rings"]:
    for _m in _r["members"]:
        _ring_of_node[_m] = _r["id"]

_ring_of_tx = {}
for _r in RESULT["rings"]:
    for _tid in _r["tx_ids"]:
        _ring_of_tx[_tid] = _r["id"]

GRAPH_PAYLOAD = {
    "nodes": [
        {
            "id": n["id"],
            "country": n["country"],
            "phase": n["phase"],
            "risk": RESULT["flags"][n["id"]]["score"],
            "ring": _ring_of_node.get(n["id"]),
            "hub": any(r["hub"] == n["id"] for r in RESULT["rings"]),
            "community": RESULT["features"][n["id"]]["community"],
            "in_deg": RESULT["features"][n["id"]]["in_deg"],
            "out_deg": RESULT["features"][n["id"]]["out_deg"],
            "total_in": RESULT["features"][n["id"]]["total_in"],
            "total_out": RESULT["features"][n["id"]]["total_out"],
        }
        for n in DATA["nodes"].values()
    ],
    "links": [
        {
            "id": t["id"],
            "source": t["source"],
            "target": t["target"],
            "amount": t["amount"],
            "ts": t["ts"],
            "phase": t["phase"],
            "cross": t["cross"],
            "ring": _ring_of_tx.get(t["id"]),
        }
        for t in DATA["txs"]
    ],
    "rings": [
        {k: v for k, v in r.items() if k != "tx_ids"} for r in RESULT["rings"]
    ],
    "stats": {
        "accounts": len(DATA["nodes"]),
        "transactions": len(DATA["txs"]),
        "rings": len(RESULT["rings"]),
        "flagged_value": round(sum(r["total_amount"] for r in RESULT["rings"]), 2),
        "precision": RESULT["precision"],
        "recall": RESULT["recall"],
        "communities": RESULT["n_communities"],
    },
    "window": DATA["window"],
}


class SarRequest(BaseModel):
    llm: bool = False


@app.get("/api/graph")
def get_graph():
    return GRAPH_PAYLOAD


@app.get("/api/rings")
def get_rings():
    return GRAPH_PAYLOAD["rings"]


@app.get("/api/stats")
def get_stats():
    return GRAPH_PAYLOAD["stats"]


@app.post("/api/sar/{ring_id}")
def get_sar(ring_id: str, req: SarRequest):
    ring = RINGS_BY_ID.get(ring_id)
    if ring is None:
        raise HTTPException(404, f"unknown ring {ring_id}")
    template = build_template_sar(ring)
    if req.llm:
        text, used, note = polish_with_claude(template, ring)
        return {"sar": text, "llm_used": used, "note": note}
    return {"sar": template, "llm_used": False, "note": "Deterministic template SAR."}


# Serve the built frontend when it exists (single-process demo mode)
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
