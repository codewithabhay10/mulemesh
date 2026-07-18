import { useEffect, useRef, useState } from "react";
import { fetchSar } from "../api";
import { formatINR, riskColor } from "../risk";

function ScoreDial({ score }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 84 84" className="dial">
      <circle cx="42" cy="42" r={R} className="dial-bg" />
      <circle
        cx="42"
        cy="42"
        r={R}
        className="dial-fg"
        style={{
          strokeDasharray: `${(score / 100) * C} ${C}`,
          stroke: riskColor(score),
        }}
      />
      <text x="42" y="44" className="dial-num">
        {score}
      </text>
      <text x="42" y="58" className="dial-cap">
        RISK
      </text>
    </svg>
  );
}

function flagOf(nodesById, id) {
  return nodesById[id]?.country === "SG" ? "🇸🇬" : "🇮🇳";
}

function RingPanel({ ring, nodesById, onClose }) {
  const [sar, setSar] = useState(null);
  const [shown, setShown] = useState("");
  const [note, setNote] = useState("");
  const [llmUsed, setLlmUsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const preRef = useRef(null);

  useEffect(() => {
    setSar(null);
    setShown("");
    setNote("");
    setLlmUsed(false);
    fetchSar(ring.id, false)
      .then((r) => {
        setSar(r.sar);
        setNote(r.note);
      })
      .catch(() => setNote("SAR fetch failed."));
  }, [ring.id]);

  // typewriter reveal
  useEffect(() => {
    if (sar == null) return;
    let i = 0;
    setShown("");
    const iv = setInterval(() => {
      i = Math.min(sar.length, i + 16);
      setShown(sar.slice(0, i));
      if (i >= sar.length) clearInterval(iv);
    }, 12);
    return () => clearInterval(iv);
  }, [sar]);

  async function polish() {
    setLoading(true);
    try {
      const r = await fetchSar(ring.id, true);
      setSar(r.sar);
      setNote(r.note);
      setLlmUsed(r.llm_used);
    } catch {
      setNote("Claude call failed — keeping template.");
    }
    setLoading(false);
  }

  function copy() {
    navigator.clipboard?.writeText(sar ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose}>
        ✕
      </button>

      <div className="panel-head">
        <ScoreDial score={ring.score} />
        <div>
          <span className="chip chip-red">{ring.typology}</span>
          <h2>{ring.id}</h2>
          <p className="corridor">
            India (UPI) <span className="corridor-arrow">⇢</span> Singapore
            (PayNow)
          </p>
        </div>
      </div>

      <div className="panel-stats">
        <div>
          <b>₹{formatINR(ring.total_amount)}</b>
          <span>value moved</span>
        </div>
        <div>
          <b>{ring.tx_count}</b>
          <span>transactions</span>
        </div>
        <div>
          <b>{ring.members.length}</b>
          <span>mule accounts</span>
        </div>
        <div>
          <b>#{ring.community}</b>
          <span>louvain community</span>
        </div>
      </div>

      <h3>Why it was flagged</h3>
      <ul className="rules">
        {ring.rules.map((r) => (
          <li key={r.code}>
            <div className="rule-top">
              <span className="rule-name">{r.name}</span>
              <span className="rule-weight">+{r.weight}</span>
            </div>
            <p>{r.detail}</p>
            <code>{r.account}</code>
          </li>
        ))}
      </ul>

      <h3>Ring members</h3>
      <ul className="members">
        {ring.members.map((m) => (
          <li key={m}>
            <span>{flagOf(nodesById, m)}</span>
            <code>{m}</code>
            {m === ring.hub && <span className="chip chip-mini">HUB</span>}
          </li>
        ))}
      </ul>

      {ring.victims.length > 0 && (
        <>
          <h3>Source / victim accounts</h3>
          <ul className="members victims">
            {ring.victims.map((v) => (
              <li key={v}>
                <span>{flagOf(nodesById, v)}</span>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="sar-head">
        <h3>Suspicious Activity Report</h3>
        <div className="sar-actions">
          <button className="btn-ghost" onClick={copy} disabled={!sar}>
            {copied ? "copied ✓" : "copy"}
          </button>
          <button
            className="btn-claude"
            onClick={polish}
            disabled={loading || llmUsed}
          >
            {loading ? "Claude is drafting…" : llmUsed ? "✦ polished" : "✦ Polish with Claude"}
          </button>
        </div>
      </div>
      {note && <p className="sar-note">{note}</p>}
      <pre className="sar" ref={preRef}>
        {shown || "generating…"}
        {sar && shown.length < sar.length ? "▌" : ""}
      </pre>
    </aside>
  );
}

function NodePanel({ node, detectedSet, onClose }) {
  if (!node) return null;
  const revealed = !node.ring || detectedSet.has(node.ring);
  const risk = revealed ? node.risk : 12;
  return (
    <aside className="panel">
      <button className="panel-close" onClick={onClose}>
        ✕
      </button>
      <div className="panel-head">
        <ScoreDial score={risk} />
        <div>
          <span className="chip">
            {node.country === "IN" ? "India · UPI" : "Singapore · PayNow"}
          </span>
          <h2 className="node-id">{node.id}</h2>
          {node.ring && revealed && (
            <p className="corridor">member of {node.ring}</p>
          )}
        </div>
      </div>
      <div className="panel-stats">
        <div>
          <b>{node.in_deg}</b>
          <span>senders</span>
        </div>
        <div>
          <b>{node.out_deg}</b>
          <span>receivers</span>
        </div>
        <div>
          <b>₹{formatINR(node.total_in)}</b>
          <span>inflow</span>
        </div>
        <div>
          <b>₹{formatINR(node.total_out)}</b>
          <span>outflow</span>
        </div>
      </div>
      <p className="node-note">
        {revealed && node.risk >= 45
          ? "This account is part of a flagged ring — click any glowing node to open the ring dossier."
          : "No typology rules triggered for this account. It participates in normal-looking payment activity."}
      </p>
    </aside>
  );
}

export default function SidePanel({
  selected,
  ringsById,
  nodesById,
  detectedSet,
  onClose,
}) {
  if (!selected) return null;
  if (selected.type === "ring") {
    const ring = ringsById[selected.id];
    if (!ring) return null;
    return <RingPanel ring={ring} nodesById={nodesById} onClose={onClose} />;
  }
  return (
    <NodePanel
      node={nodesById[selected.id]}
      detectedSet={detectedSet}
      onClose={onClose}
    />
  );
}
