"""Suspicious Activity Report generation.

Default: a deterministic template filled from the detected ring's data.
Optional: rewrite in polished regulator prose via the Anthropic API
(reads ANTHROPIC_API_KEY from the environment; template is the fallback
on any failure, so the demo never breaks).
"""

import datetime
import os

TYPOLOGY_NARRATIVE = {
    "FAN_IN_FAN_OUT": (
        "Funds from {n_victims} apparently unrelated India-side (UPI) accounts "
        "converged on a single newly active account within a compressed window, "
        "after which the balance was dispersed to {n_members} downstream "
        "accounts, including PayNow accounts in Singapore. The convergence-"
        "dispersal pattern, account age, and velocity are characteristic of a "
        "money-mule collection hub."
    ),
    "LAYERING": (
        "A single large credit of approximately {entry_amount} was moved "
        "through a chain of {n_members} accounts in rapid succession, with "
        "each hop forwarding 96-99% of the amount within minutes and the "
        "final hops crossing the India-Singapore corridor. The sequential "
        "pass-through structure with per-hop attrition is characteristic of "
        "layering intended to obscure the origin of funds."
    ),
    "SMURFING": (
        "A single source account split a large balance into {tx_count} "
        "transfers each kept below the ₹50,000 reporting threshold, routed "
        "through {n_members} intermediary accounts, and re-aggregated in a "
        "single Singapore PayNow account. The consistent just-under-threshold "
        "amounts indicate deliberate structuring to evade reporting."
    ),
}


def _fmt(amount: float) -> str:
    return f"₹{amount:,.0f}"


def build_template_sar(ring: dict) -> str:
    today = datetime.date.today().isoformat()
    case_no = ring["id"].replace("RING-", "")
    narrative = TYPOLOGY_NARRATIVE[ring["typology_code"]].format(
        n_victims=len(ring["victims"]),
        n_members=len(ring["members"]),
        tx_count=ring["tx_count"],
        entry_amount=_fmt(ring["total_amount"] / max(1, ring["tx_count"])),
    )

    members = "\n".join(
        f"  - {m}  ({'India / UPI' if '@' in m and not m.endswith('.sg') else 'Singapore / PayNow'})"
        for m in ring["members"]
    )
    victims = "\n".join(f"  - {v}" for v in ring["victims"]) or "  - (none identified)"
    rules = "\n".join(
        f"  - [{r['code']}] {r['name']}: {r['detail']}" for r in ring["rules"]
    )

    return f"""SUSPICIOUS ACTIVITY REPORT
==========================================================
Case Reference   : SAR-2026-{case_no}
Filing Entity    : MuleMesh Analytics (Demo Environment)
Date of Report   : {today}
Jurisdictions    : India (UPI) / Singapore (PayNow)
Corridor         : {ring['corridor']}
Typology         : {ring['typology']}
Composite Risk   : {ring['score']} / 100

1. SUMMARY OF SUSPICION
{narrative}

2. SUBJECT ACCOUNTS ({len(ring['members'])})
{members}

3. SOURCE / VICTIM ACCOUNTS ({len(ring['victims'])})
{victims}

4. TRANSACTION SUMMARY
  Total value moved : {_fmt(ring['total_amount'])}
  Transaction count : {ring['tx_count']}
  Focal account     : {ring['hub']}
  Detection window  : synthetic 6-hour observation period

5. BASIS FOR DETECTION (RULE TRACE)
{rules}

6. RECOMMENDED ACTION
  Freeze the focal account pending review; file STR with FIU-IND and
  STRO Singapore; request KYC refresh on all subject accounts; notify
  counterpart institutions on the IN-SG corridor.

--- END OF REPORT ---
This report was generated from SYNTHETIC data for demonstration purposes.
"""


def polish_with_claude(sar_text: str, ring: dict) -> tuple[str, bool, str]:
    """Rewrite the template SAR in regulator prose via the Anthropic API.

    Returns (text, llm_used, note). Falls back to the template on any error.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return sar_text, False, "ANTHROPIC_API_KEY not set — showing template SAR."
    try:
        import anthropic

        client = anthropic.Anthropic()
        msg = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=3000,
            thinking={"type": "adaptive"},
            system=(
                "You are a senior financial-crime compliance officer. Rewrite "
                "the suspicious activity report you are given into polished, "
                "formal regulator prose suitable for filing with FIU-India and "
                "STRO Singapore. Preserve every fact, figure, account "
                "identifier, rule code, and the case reference exactly. Keep "
                "the numbered-section structure. Note that the data is "
                "synthetic/demo. Return only the report text."
            ),
            messages=[{"role": "user", "content": sar_text}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text").strip()
        if not text:
            return sar_text, False, "Empty model response — showing template SAR."
        return text, True, "Rewritten by Claude (claude-opus-4-8)."
    except Exception as exc:  # demo must never break on API issues
        return sar_text, False, (
            f"Claude call failed ({type(exc).__name__}) — showing template SAR."
        )
