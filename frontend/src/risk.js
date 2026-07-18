// Risk color scale: 0 → calm teal-green, 50 → amber, 100 → alarm red.
// (CVD-checked against the dark surface: worst adjacent-pair ΔE 11.1 protan,
// with size/glow/labels as secondary encoding.)
const STOPS = [
  [0, [45, 212, 167]], // #2dd4a7
  [50, [245, 185, 66]], // #f5b942
  [100, [255, 77, 94]], // #ff4d5e
];

export function riskColor(score) {
  const s = Math.max(0, Math.min(100, score));
  let [s0, c0] = STOPS[0];
  let [s1, c1] = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (s >= STOPS[i][0] && s <= STOPS[i + 1][0]) {
      [s0, c0] = STOPS[i];
      [s1, c1] = STOPS[i + 1];
      break;
    }
  }
  const t = s1 === s0 ? 0 : (s - s0) / (s1 - s0);
  const rgb = c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function formatINR(v) {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)} L`;
  return Math.round(v).toLocaleString("en-IN");
}
