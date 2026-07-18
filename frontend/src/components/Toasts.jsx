import { formatINR } from "../risk";

export default function Toasts({ rings, onOpen }) {
  if (!rings.length) return null;
  return (
    <div className="toasts">
      {rings.map((r) => (
        <button key={r.id} className="toast" onClick={() => onOpen(r.id)}>
          <span className="toast-icon">🚨</span>
          <span className="toast-body">
            <b>
              {r.id} · {r.typology}
            </b>
            <small>
              risk {r.score} · ₹{formatINR(r.total_amount)} · {r.corridor} ·{" "}
              {r.members.length} accounts
            </small>
          </span>
          <span className="toast-cta">open ›</span>
        </button>
      ))}
    </div>
  );
}
