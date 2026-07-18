"""Explainable mule-ring detection over the transaction graph.

Per-node graph features (degree, fan-in/out, betweenness centrality,
velocity, pass-through, structuring band counts) feed a set of simple
weighted rules. Every point of a node's 0-100 risk score is attributable
to a named rule. Louvain community detection groups the graph; flagged
nodes are expanded along stream-phase money flow into rings.
"""

from collections import defaultdict

import networkx as nx

VELOCITY_WINDOW = 1800          # 30 minutes
STRUCT_BAND = (45000, 50000)    # just-under-threshold band
FLAG_THRESHOLD = 45

RULES = {
    "FAN_IN_FAN_OUT": ("Fan-in/fan-out hub", 40),
    "STRUCTURING": ("Sub-threshold structuring", 45),
    "LAYERING": ("Rapid pass-through layering", 50),
    "SMURF_RELAY": ("Smurf relay account", 30),
    "CROSS_BORDER_SINK": ("Cross-border aggregation sink", 35),
    "CROSS_BORDER_OUT": ("Large cross-border outflow", 20),
    "VELOCITY": ("Abnormal transaction velocity", 15),
    "FAN_IN": ("Concentrated fan-in", 15),
    "BETWEENNESS": ("High betweenness centrality", 10),
}

TYPOLOGY_NAMES = {
    "FAN_IN_FAN_OUT": "Fan-in / Fan-out Mule Hub",
    "LAYERING": "Layering Chain",
    "SMURFING": "Smurfing / Structuring Network",
}


def _fmt(amount: float) -> str:
    return f"₹{amount:,.0f}"


def _max_in_window(timestamps: list[float], window: float) -> int:
    ts = sorted(timestamps)
    best = lo = 0
    for hi in range(len(ts)):
        while ts[hi] - ts[lo] > window:
            lo += 1
        best = max(best, hi - lo + 1)
    return best


def analyze(data: dict) -> dict:
    nodes, txs = data["nodes"], data["txs"]

    # ---------------------------------------------------------------- #
    # Graph + raw per-node accumulators
    # ---------------------------------------------------------------- #
    G = nx.DiGraph()
    G.add_nodes_from(nodes)
    in_tx = defaultdict(list)
    out_tx = defaultdict(list)
    for t in txs:
        s, d = t["source"], t["target"]
        if G.has_edge(s, d):
            G[s][d]["amount"] += t["amount"]
        else:
            G.add_edge(s, d, amount=t["amount"])
        out_tx[s].append(t)
        in_tx[d].append(t)

    betweenness = nx.betweenness_centrality(G)
    bvals = sorted(v for v in betweenness.values() if v > 0)
    b_p95 = bvals[int(len(bvals) * 0.95)] if bvals else 1.0

    communities = nx.community.louvain_communities(
        G.to_undirected(), weight="amount", seed=11)
    community_of = {}
    for ci, com in enumerate(communities):
        for n in com:
            community_of[n] = ci

    # ---------------------------------------------------------------- #
    # Features + weighted rules per node
    # ---------------------------------------------------------------- #
    features, flags = {}, {}
    for n in nodes:
        ins, outs = in_tx[n], out_tx[n]
        in_deg = len({t["source"] for t in ins})
        out_deg = len({t["target"] for t in outs})
        total_in = sum(t["amount"] for t in ins)
        total_out = sum(t["amount"] for t in outs)
        velocity = _max_in_window([t["ts"] for t in ins + outs], VELOCITY_WINDOW)
        struct_out = sum(1 for t in outs if STRUCT_BAND[0] <= t["amount"] < STRUCT_BAND[1])
        struct_in = sum(1 for t in ins if STRUCT_BAND[0] <= t["amount"] < STRUCT_BAND[1])
        xb_out = sum(t["amount"] for t in outs if t["cross"])
        xb_in = sum(t["amount"] for t in ins if t["cross"])
        holding = None
        if ins and outs:
            holding = max(min(t["ts"] for t in outs) - max(t["ts"] for t in ins), 0) \
                if min(t["ts"] for t in outs) >= max(t["ts"] for t in ins) else 0
        ratio = total_out / total_in if total_in > 0 else 0.0

        fired = []

        def fire(code: str, detail: str):
            fired.append({"code": code, "name": RULES[code][0],
                          "weight": RULES[code][1], "detail": detail})

        if in_deg >= 10 and out_deg >= 5:
            fire("FAN_IN_FAN_OUT",
                 f"Receives from {in_deg} distinct senders and disperses to "
                 f"{out_deg} receivers within hours ({_fmt(total_in)} in, "
                 f"{_fmt(total_out)} out).")
        elif in_deg >= 8 and out_deg <= 1:
            fire("FAN_IN",
                 f"{in_deg} distinct senders converge on this account "
                 f"({_fmt(total_in)} received).")

        if struct_out >= 5:
            fire("STRUCTURING",
                 f"{struct_out} outgoing transfers of ₹45,000–50,000 — "
                 f"consistently just under the ₹50,000 reporting threshold.")

        if (in_deg <= 2 and out_deg <= 2 and total_in >= 200000
                and 0.90 <= ratio <= 1.02 and holding is not None
                and holding < VELOCITY_WINDOW):
            fire("LAYERING",
                 f"Pass-through layering hop: forwards {ratio * 100:.0f}% of "
                 f"{_fmt(total_in)} within {max(holding, 60) / 60:.0f} minutes "
                 f"of receipt.")

        if (struct_in >= 1 and in_deg <= 2 and total_in > 0 and ratio >= 0.90
                and holding is not None and holding < 3600):
            fire("SMURF_RELAY",
                 f"Receives sub-threshold transfer(s) in the ₹45–50k "
                 f"band and relays {ratio * 100:.0f}% onward within the hour.")

        if xb_in >= 200000 and in_deg >= 5 and out_deg == 0:
            fire("CROSS_BORDER_SINK",
                 f"Terminal account absorbing {_fmt(xb_in)} of cross-border "
                 f"inflow from {in_deg} IN-side senders.")

        if xb_out >= 100000:
            fire("CROSS_BORDER_OUT",
                 f"Moves {_fmt(xb_out)} across the IN→SG corridor.")

        if velocity >= 6:
            fire("VELOCITY",
                 f"{velocity} transactions inside a 30-minute window.")

        if betweenness[n] >= b_p95 and betweenness[n] > 0:
            fire("BETWEENNESS",
                 "Sits on an unusually high share of shortest payment paths "
                 "(top 5% betweenness centrality).")

        score = min(100, sum(f["weight"] for f in fired))
        features[n] = {
            "in_deg": in_deg, "out_deg": out_deg,
            "total_in": round(total_in, 2), "total_out": round(total_out, 2),
            "velocity": velocity, "betweenness": round(betweenness[n], 5),
            "community": community_of.get(n, -1),
        }
        flags[n] = {"score": score, "rules": fired}

    flagged = {n for n in nodes if flags[n]["score"] >= FLAG_THRESHOLD}

    # ---------------------------------------------------------------- #
    # Ring assembly: flagged cores expanded along stream-phase money flow
    # ---------------------------------------------------------------- #
    stream_succ = defaultdict(set)
    for t in txs:
        if t["phase"] == "stream" and t["amount"] >= 20000:
            stream_succ[t["source"]].add(t["target"])

    members_pool = set(flagged)
    for f in flagged:
        members_pool |= stream_succ[f]  # downstream mule accounts

    sub = G.to_undirected().subgraph(members_pool)
    rings = []
    for comp in nx.connected_components(sub):
        comp_flagged = comp & flagged
        if len(comp) < 4 or not comp_flagged:
            continue

        ring_tx = [t for t in txs
                   if t["source"] in comp and t["target"] in comp
                   and t["phase"] == "stream"]
        if sum(t["amount"] for t in ring_tx) < 200000:
            continue

        codes = {r["code"] for m in comp_flagged for r in flags[m]["rules"]}
        if "FAN_IN_FAN_OUT" in codes:
            typology = "FAN_IN_FAN_OUT"
        elif "STRUCTURING" in codes:
            typology = "SMURFING"
        else:
            typology = "LAYERING"

        hub = max(comp_flagged, key=lambda m: flags[m]["score"])
        max_base = max(flags[m]["score"] for m in comp_flagged)
        ring_score = min(98, max_base + 4 * len(comp_flagged))

        # community-risk propagation: unflagged members inherit ring risk
        for m in comp:
            propagated = int(ring_score * 0.85)
            if flags[m]["score"] < propagated:
                flags[m]["score"] = propagated
                flags[m]["rules"].append({
                    "code": "COMMUNITY_RISK",
                    "name": "Flagged-ring membership",
                    "weight": 0,
                    "detail": "Direct money-flow counterparty inside a "
                              "flagged ring (risk propagated from ring core).",
                })

        victims = sorted({t["source"] for t in txs
                          if t["phase"] == "stream" and t["target"] in comp
                          and t["source"] not in comp})
        countries = {nodes[m]["country"] for m in comp}
        rule_rollup = []
        seen = set()
        for m in sorted(comp_flagged, key=lambda m: -flags[m]["score"]):
            for r in flags[m]["rules"]:
                if r["code"] in ("COMMUNITY_RISK",) or r["code"] in seen:
                    continue
                seen.add(r["code"])
                rule_rollup.append({**r, "account": m})

        rings.append({
            "typology_code": typology,
            "typology": TYPOLOGY_NAMES[typology],
            "score": ring_score,
            "hub": hub,
            "members": sorted(comp, key=lambda m: -flags[m]["score"]),
            "victims": victims,
            "total_amount": round(sum(t["amount"] for t in ring_tx), 2),
            "tx_count": len(ring_tx),
            "tx_ids": [t["id"] for t in ring_tx],
            "corridor": "IN → SG" if countries == {"IN", "SG"} else "domestic",
            "reveal_ts": max(t["ts"] for t in ring_tx),
            "community": features[hub]["community"],
            "rules": rule_rollup,
            "first_ts": min(t["ts"] for t in ring_tx),
        })

    rings.sort(key=lambda r: r["reveal_ts"])
    for i, r in enumerate(rings, 1):
        r["id"] = f"RING-{i:03d}"

    # ---------------------------------------------------------------- #
    # Precision / recall vs injected ground truth
    # ---------------------------------------------------------------- #
    gt_members = {m for g in data["rings_gt"] for m in g["members"]}
    det_members = {m for r in rings for m in r["members"]}
    tp = len(gt_members & det_members)
    precision = tp / len(det_members) if det_members else 0.0
    recall = tp / len(gt_members) if gt_members else 0.0

    return {
        "features": features,
        "flags": flags,
        "rings": rings,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "n_communities": len(communities),
    }
