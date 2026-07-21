// MuleMesh brand mark — the product compressed into one glyph.
//
// Six accounts meshed around a single mule hub: fan-in on the left, fan-out on
// the right. The hexagon is the ring, the spokes are the money. Same story
// RING-001 tells, at 16px.
//
// Black + yellow, matching brand/mulemesh-logo-light.svg. This is the DARK
// surface variant: on the poster the wires and hub are black on white, here
// they're yellow on near-black, so the hub reads as a ring rather than a blob.
// Flat colours only — no gradients or blur, which turn to mud at favicon size.

const YELLOW = "#ffc400";
const HUB_INK = "#0d0d0d";

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
  { cx: 12.95, cy: 21 },
  { cx: 12.95, cy: 43 },
  { cx: 32, cy: 10 },
  { cx: 32, cy: 54 },
  { cx: 51.05, cy: 21 },
  { cx: 51.05, cy: 43 },
];

export function MeshMark({ size = 42, tile = false, className, title = "MuleMesh" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
    >
      {tile && <rect width="64" height="64" rx="15" fill={HUB_INK} />}

      {/* the ring — dimmed so the accounts carry the mark */}
      <path
        d={HEX}
        fill="none"
        stroke={YELLOW}
        strokeWidth="1.9"
        strokeLinejoin="round"
        opacity="0.4"
      />

      {/* the money */}
      <g stroke={YELLOW} strokeWidth="2.5" strokeLinecap="round" opacity="0.55">
        {SPOKES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* the accounts */}
      {NODES.map((n) => (
        <circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r="4.5" fill={YELLOW} />
      ))}

      {/* the mule hub */}
      <circle cx="32" cy="32" r="8.4" fill={HUB_INK} stroke={YELLOW} strokeWidth="2.6" />
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
