import { MeshMark } from "./Logo";

// Branded intro. Sits over the app while the corridor + satellite tiles load
// behind it, then fades/scales away to "open" into the map.
export default function Splash({ leaving }) {
  return (
    <div className={`splash${leaving ? " leaving" : ""}`}>
      <div className="splash-inner">
        <MeshMark size={78} className="splash-mark" />
        <h1 className="splash-title">
          Mule<span>Mesh</span>
        </h1>
        <p className="splash-sub">India UPI ↔ Singapore PayNow</p>
        <div className="splash-bar">
          <span />
        </div>
        <p className="splash-load">Loading the synthetic corridor…</p>
      </div>
    </div>
  );
}
