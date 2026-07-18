"""Synthetic cross-border (India UPI <-> Singapore PayNow) transaction graph.

Generates ~250 normal accounts with organic transfers, then injects three
mule-ring patterns with ground-truth labels:

  RING A  fan-in/fan-out hub   (many victims -> 1 mule -> dispersal, IN -> SG)
  RING B  layering chain       (victim -> A -> B -> C -> D -> E -> F, ends in SG)
  RING C  smurfing             (1 source -> sub-threshold splits -> SG aggregator)

Timestamps are seconds in a synthetic 6-hour window [0, 21600].
Transactions tagged phase="baseline" are visible before the demo plays;
phase="stream" transactions are streamed in during playback.
All amounts are INR-equivalent.
"""

import random

SEED = 7
WINDOW = 21600  # 6 hours

IN_FIRST = ["rahul", "priya", "amit", "sneha", "vikram", "ananya", "rohan",
            "kavya", "arjun", "isha", "karan", "meera", "sid", "pooja",
            "aditya", "nisha", "manish", "divya", "harsh", "ritika",
            "sanjay", "tanvi", "deepak", "shreya", "nikhil"]
IN_LAST = ["sharma", "verma", "patel", "gupta", "singh", "mehta", "iyer",
           "nair", "reddy", "joshi", "kapoor", "malhotra", "chopra",
           "desai", "bose"]
IN_BANKS = ["okhdfc", "oksbi", "okicici", "okaxis", "ybl", "paytm"]

SG_FIRST = ["weiling", "junjie", "meifen", "kokwee", "siewmay", "zhihao",
            "huimin", "jiahui", "yongsheng", "xinyi", "liwei", "shufen",
            "boonkeng", "peiling", "chenghan", "aikleng", "daniel",
            "rachel", "marcus", "cheryl"]
SG_LAST = ["tan", "lim", "lee", "ng", "wong", "goh", "chua", "teo", "ong",
           "koh", "chan", "yeo", "toh", "sim", "low"]
SG_BANKS = ["dbs.sg", "ocbc.sg", "uob.sg", "posb.sg"]


def generate(seed: int = SEED):
    rng = random.Random(seed)
    nodes: dict[str, dict] = {}
    txs: list[dict] = []
    tx_counter = [0]

    def add_account(country: str, phase: str = "baseline") -> str:
        for _ in range(300):
            if country == "IN":
                name = f"{rng.choice(IN_FIRST)}.{rng.choice(IN_LAST)}@{rng.choice(IN_BANKS)}"
            else:
                name = f"{rng.choice(SG_FIRST)}.{rng.choice(SG_LAST)}@{rng.choice(SG_BANKS)}"
            if name not in nodes:
                break
        else:
            name = f"{name.split('@')[0]}{len(nodes)}@{name.split('@')[1]}"
        nodes[name] = {"id": name, "country": country, "phase": phase}
        return name

    def add_tx(src: str, dst: str, amount: float, ts: float, phase: str,
               ring: str | None = None) -> str:
        tx_counter[0] += 1
        tid = f"tx{tx_counter[0]}"
        txs.append({
            "id": tid,
            "source": src,
            "target": dst,
            "amount": round(amount, 2),
            "ts": round(ts, 1),
            "phase": phase,
            "ring": ring,
            "cross": nodes[src]["country"] != nodes[dst]["country"],
        })
        return tid

    # ------------------------------------------------------------------ #
    # 1. Normal population + organic traffic
    # ------------------------------------------------------------------ #
    in_accounts = [add_account("IN") for _ in range(150)]
    sg_accounts = [add_account("SG") for _ in range(100)]

    def organic_tx(src: str, phase: str = "baseline", ts: float | None = None):
        same = nodes[src]["country"]
        pool = in_accounts if same == "IN" else sg_accounts
        if rng.random() < 0.12:  # occasional legitimate cross-border remittance
            pool = sg_accounts if same == "IN" else in_accounts
        dst = rng.choice(pool)
        if dst == src:
            return
        amount = min(44000.0, rng.lognormvariate(8.7, 0.9))
        add_tx(src, dst, max(150.0, amount),
               rng.uniform(0, WINDOW) if ts is None else ts, phase)

    for acct in in_accounts + sg_accounts:
        for _ in range(rng.choices([1, 2, 3, 4], [0.30, 0.35, 0.25, 0.10])[0]):
            organic_tx(acct)

    # ambient normal traffic that arrives during playback, so the stream
    # doesn't consist solely of mule activity
    for _ in range(45):
        organic_tx(rng.choice(in_accounts + sg_accounts), phase="stream",
                   ts=rng.uniform(600, WINDOW - 800))

    rings_gt = []

    # ------------------------------------------------------------------ #
    # 2. RING A — fan-in / fan-out hub (IN hub, dispersal into SG)
    # ------------------------------------------------------------------ #
    hub = add_account("IN", "stream")
    victims_a = rng.sample(in_accounts, 14)
    recv_a = [add_account("SG", "stream") for _ in range(5)] + \
             [add_account("IN", "stream") for _ in range(3)]

    ring_txs = []
    ts, total_in = 1200.0, 0.0
    for v in victims_a:
        amt = rng.uniform(35000, 85000)
        total_in += amt
        ring_txs.append(add_tx(v, hub, amt, ts, "stream", "A"))
        ts += rng.uniform(160, 330)

    ts = max(ts + 350, 5000)
    weights = [rng.uniform(0.7, 1.4) for _ in recv_a]
    wsum = sum(weights)
    for r, w in zip(recv_a, weights):
        ring_txs.append(add_tx(hub, r, total_in * 0.95 * w / wsum, ts, "stream", "A"))
        ts += rng.uniform(130, 260)

    rings_gt.append({
        "gt_id": "A",
        "typology_code": "FAN_IN_FAN_OUT",
        "hub": hub,
        "members": [hub] + recv_a,
        "victims": victims_a,
        "tx_ids": ring_txs,
        "reveal_ts": max(t["ts"] for t in txs if t["id"] in set(ring_txs)),
    })

    # ------------------------------------------------------------------ #
    # 3. RING B — layering chain (IN victim -> 4 IN hops -> 2 SG hops)
    # ------------------------------------------------------------------ #
    chain = [add_account("IN", "stream") for _ in range(4)] + \
            [add_account("SG", "stream") for _ in range(2)]
    victim_b = rng.choice([a for a in in_accounts if a not in victims_a])

    ring_txs = []
    amt, ts = 940000.0, 8200.0
    ring_txs.append(add_tx(victim_b, chain[0], amt, ts, "stream", "B"))
    for i in range(len(chain) - 1):
        ts += rng.uniform(420, 700)
        amt *= rng.uniform(0.965, 0.985)  # small layering fee at each hop
        ring_txs.append(add_tx(chain[i], chain[i + 1], amt, ts, "stream", "B"))

    rings_gt.append({
        "gt_id": "B",
        "typology_code": "LAYERING",
        "hub": chain[0],
        "members": list(chain),
        "victims": [victim_b],
        "tx_ids": ring_txs,
        "reveal_ts": ts,
    })

    # ------------------------------------------------------------------ #
    # 4. RING C — smurfing (sub-50k splits, then SG aggregation)
    # ------------------------------------------------------------------ #
    source = add_account("IN", "stream")
    smurfs = [add_account("IN", "stream") for _ in range(10)]
    agg = add_account("SG", "stream")

    ring_txs = []
    received = {m: 0.0 for m in smurfs}
    ts = 13800.0
    for i in range(19):
        m = smurfs[i % len(smurfs)]
        amt = rng.uniform(47500, 49900)  # just under the 50k reporting threshold
        received[m] += amt
        ring_txs.append(add_tx(source, m, amt, ts, "stream", "C"))
        ts += rng.uniform(120, 240)

    ts += 420
    for m in smurfs:
        ring_txs.append(add_tx(m, agg, received[m] * rng.uniform(0.93, 0.98),
                               ts, "stream", "C"))
        ts += rng.uniform(120, 260)

    rings_gt.append({
        "gt_id": "C",
        "typology_code": "SMURFING",
        "hub": source,
        "members": [source] + smurfs + [agg],
        "victims": [],
        "tx_ids": ring_txs,
        "reveal_ts": ts,
    })

    return {"nodes": nodes, "txs": txs, "rings_gt": rings_gt, "window": WINDOW}
