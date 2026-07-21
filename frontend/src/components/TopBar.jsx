import { useEffect, useRef, useState } from "react";
import { formatINR } from "../risk";
import { MeshMark } from "./Logo";

function Kpi({ label, value, format, alert, accent }) {
  const [disp, setDisp] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = typeof value === "number" ? value : 0;
    prev.current = to;
    if (from === to) {
      setDisp(to);
      return;
    }
    const t0 = performance.now();
    const dur = 700;
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  let text;
  if (value == null) text = "—";
  else if (format === "inr") text = `₹${formatINR(disp)}`;
  else if (format === "pct") text = `${Math.round(disp * 100)}%`;
  else text = Math.round(disp).toLocaleString("en-IN");

  return (
    <div className={`kpi${alert ? " alert" : ""}`} style={{ "--kpi-accent": accent }}>
      <span className="kpi-value">{text}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}

export default function TopBar({
  stats,
  detectedCount,
  flaggedValue,
  precision,
  recall,
  phase,
  progress,
  onPlay,
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <MeshMark size={44} className="brand-mark" />
        <div className="brand-text">
          <h1>
            Mule<span>Mesh</span>
          </h1>
          <p>India UPI ↔ Singapore PayNow</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi-cluster">
          <Kpi label="accounts scanned" value={stats.accounts} accent="var(--blue)" />
          <span className="kpi-sep" />
          <Kpi label="transactions" value={stats.transactions} accent="var(--blue)" />
          <span className="kpi-sep" />
          <Kpi
            label="rings detected"
            value={detectedCount}
            alert={detectedCount > 0}
            accent="var(--red)"
          />
          <span className="kpi-sep" />
          <Kpi
            label="flagged value"
            value={flaggedValue}
            format="inr"
            alert={flaggedValue > 0}
            accent="var(--gold)"
          />
          <span className="kpi-sep" />
          <Kpi
            label={recall != null ? `precision · recall ${Math.round(recall * 100)}%` : "precision"}
            value={precision}
            format="pct"
            accent="var(--green)"
          />
        </div>
      </div>

      <button
        className={`play-btn ${phase}`}
        onClick={onPlay}
        disabled={phase === "playing"}
      >
        {phase === "idle" ? "▶ Play" : phase === "playing" ? "● Live" : "↻ Replay"}
      </button>

      <div className="progress">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
    </header>
  );
}
