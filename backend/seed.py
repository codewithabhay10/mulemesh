"""Seed script: regenerate the synthetic dataset, run detection, and print a
summary (plus dump backend/data.json for inspection).

Usage:  python backend/seed.py [seed]
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.detection import analyze  # noqa: E402
from app.generator import generate  # noqa: E402


def main() -> None:
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    data = generate(seed)
    result = analyze(data)

    out = Path(__file__).parent / "data.json"
    out.write_text(json.dumps({
        "nodes": list(data["nodes"].values()),
        "txs": data["txs"],
        "rings_detected": result["rings"],
        "precision": result["precision"],
        "recall": result["recall"],
    }, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"seed={seed}  accounts={len(data['nodes'])}  txs={len(data['txs'])}  "
          f"communities={result['n_communities']}")
    print(f"precision={result['precision']}  recall={result['recall']}")
    flagged = [n for n, f in result["flags"].items() if f["score"] >= 45]
    print(f"flagged nodes={len(flagged)}")
    for r in result["rings"]:
        print(f"\n{r['id']}  {r['typology']}  score={r['score']}  "
              f"members={len(r['members'])}  victims={len(r['victims'])}  "
              f"value=₹{r['total_amount']:,.0f}  corridor={r['corridor']}  "
              f"reveal_ts={r['reveal_ts']}")
        for m in r["members"]:
            print(f"    {result['flags'][m]['score']:>3}  {m}  "
                  f"[{', '.join(x['code'] for x in result['flags'][m]['rules'])}]")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
