// Hand-drawn SVG flags. Emoji regional-indicator flags do NOT render on
// Windows (they fall back to letter pairs), so the corridor view uses these.

function star(cx, cy, outer, inner, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / 5;
    const x = (cx + Math.cos(a) * r).toFixed(2);
    const y = (cy + Math.sin(a) * r).toFixed(2);
    d += `${i === 0 ? "M" : "L"}${x},${y}`;
  }
  return d + "Z";
}

export function IndiaFlag({ className }) {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    return (
      <line
        key={i}
        x1="45"
        y1="30"
        x2={(45 + Math.cos(a) * 7.1).toFixed(2)}
        y2={(30 + Math.sin(a) * 7.1).toFixed(2)}
        stroke="#0a0a63"
        strokeWidth="0.7"
      />
    );
  });
  return (
    <svg className={className} viewBox="0 0 90 60" preserveAspectRatio="xMidYMid meet">
      <rect width="90" height="20" fill="#ff9933" />
      <rect y="20" width="90" height="20" fill="#ffffff" />
      <rect y="40" width="90" height="20" fill="#138808" />
      <circle cx="45" cy="30" r="7.7" fill="none" stroke="#0a0a63" strokeWidth="1.1" />
      {spokes}
      <circle cx="45" cy="30" r="1.5" fill="#0a0a63" />
    </svg>
  );
}

export function SingaporeFlag({ className }) {
  const cluster = [34, 15];
  const ringR = 5.2;
  const stars = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const cx = cluster[0] + Math.cos(a) * ringR;
    const cy = cluster[1] + Math.sin(a) * ringR;
    return <path key={i} d={star(cx, cy, 2.2, 0.95)} fill="#ffffff" />;
  });
  return (
    <svg className={className} viewBox="0 0 90 60" preserveAspectRatio="xMidYMid meet">
      <mask id="sg-crescent">
        <rect width="90" height="60" fill="black" />
        <circle cx="19" cy="15" r="9.6" fill="white" />
        <circle cx="24.5" cy="15" r="9.6" fill="black" />
      </mask>
      <rect width="90" height="60" fill="#ef3340" />
      <rect y="30" width="90" height="30" fill="#ffffff" />
      <rect width="90" height="60" fill="#ffffff" mask="url(#sg-crescent)" />
      {stars}
    </svg>
  );
}
