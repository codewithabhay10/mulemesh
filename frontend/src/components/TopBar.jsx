import { useEffect, useRef, useState } from "react";
import { formatINR } from "../risk";

function Kpi({ label, value, format, alert }) {
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
    <div className={`kpi${alert ? " alert" : ""}`}>
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
        <span className="brand-mark">◉</span>
        <div>
          <h1>
            Mule<span>Mesh</span>
          </h1>
          <p>India UPI ↔ Singapore PayNow · synthetic corridor</p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="accounts scanned" value={stats.accounts} />
        <Kpi label="transactions" value={stats.transactions} />
        <Kpi
          label="rings detected"
          value={detectedCount}
          alert={detectedCount > 0}
        />
        <Kpi
          label="flagged value"
          value={flaggedValue}
          format="inr"
          alert={flaggedValue > 0}
        />
        <Kpi
          label={recall != null ? `precision · recall ${Math.round(recall * 100)}%` : "precision"}
          value={precision}
          format="pct"
        />
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
