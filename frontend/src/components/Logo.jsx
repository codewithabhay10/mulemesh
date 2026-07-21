import { useId } from "react";

// MuleMesh brand mark — the product compressed into one glyph.
//
// Six accounts meshed around a single hot hub: teal on the left (India, the
// fan-in victims), gold on the right (Singapore, the fan-out dispersal), and a
// red mule hub burning in the middle. The hexagon is the ring; the spokes are
// the money. Same story RING-001 tells, at 16px.
//
// Colours are the app's own tokens (--green/--blue/--gold/--red) hard-coded so
// the file also works standalone (favicon, slide deck, README).

const HEX = "M32 10 51.05 21 51.05 43 32 54 12.95 43 12.95 21Z";

const SPOKES = [
  "M12.95 21 32 32", // fan-in
  "M12.95 43 32 32",
  "M32 10 32 32",
  "M32 54 32 32",
  "M32 32 51.05 21", // fan-out
  "M32 32 51.05 43",
];

const NODES = [
  { cx: 12.95, cy: 21, r: 4.3, fill: "#2dd4a7" },
  { cx: 12.95, cy: 43, r: 4.3, fill: "#2dd4a7" },
  { cx: 32, cy: 10, r: 3.6, fill: "#7aa2ff" },
  { cx: 32, cy: 54, r: 3.6, fill: "#7aa2ff" },
  { cx: 51.05, cy: 21, r: 4.3, fill: "#f5c542" },
  { cx: 51.05, cy: 43, r: 4.3, fill: "#f5c542" },
];

export function MeshMark({ size = 42, tile = false, className, title = "MuleMesh" }) {
  // SVG ids are document-global — two marks on one page would share (and fight
  // over) the same gradients without this.
  const uid = useId().replace(/:/g, "");
  const wire = `mm-wire-${uid}`;
  const hub = `mm-hub-${uid}`;
  const glow = `mm-glow-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
    >
      <defs>
        {/* userSpaceOnUse, not the default objectBoundingBox: the vertical
            spokes have a zero-width bbox and would render as a flat colour. */}
        <linearGradient id={wire} gradientUnits="userSpaceOnUse" x1="8" y1="0" x2="56" y2="0">
          <stop offset="0" stopColor="#2dd4a7" />
          <stop offset="0.5" stopColor="#7aa2ff" />
          <stop offset="1" stopColor="#f5c542" />
        </linearGradient>
        <radialGradient id={hub} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="0.55" stopColor="#f5c542" />
          <stop offset="1" stopColor="#ff4d5e" />
        </radialGradient>
        <filter id={glow} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      {tile && <rect width="64" height="64" rx="15" fill="#0b1120" />}

      <path
        d={HEX}
        fill="none"
        stroke={`url(#${wire})`}
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.5"
      />

      <g stroke={`url(#${wire})`} strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
        {SPOKES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {NODES.map((n) => (
        <circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} />
      ))}

      <circle cx="32" cy="32" r="8.4" fill="#ff4d5e" opacity="0.45" filter={`url(#${glow})`} />
      <circle cx="32" cy="32" r="7.6" fill={`url(#${hub})`} />
      <circle cx="32" cy="32" r="7.6" fill="none" stroke="#ff4d5e" strokeWidth="1.5" opacity="0.9" />
    </svg>
  );
}

// Horizontal lockup: mark + wordmark + corridor tagline. Text is real HTML so
// it inherits the app's font stack instead of shipping a second one.
export function MuleMeshLogo({ size = 42, tagline = "India UPI ↔ Singapore PayNow" }) {
  return (
    <div className="brand">
      <MeshMark size={size} className="brand-mark" />
      <div className="brand-text">
        <h1>
          Mule<span>Mesh</span>
        </h1>
        {tagline && <p>{tagline}</p>}
      </div>
    </div>
  );
}

export default MeshMark;
