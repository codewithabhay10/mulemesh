// Deterministic geo placement for the satellite corridor view.
// The backend graph has no coordinates, so we scatter accounts across each
// country's landmass. Positions are hashed from the account id (stable across
// renders) and rejection-sampled against country outlines so every dot lands on
// land. A share of Indian accounts is pulled toward real metros so the big
// cities read as denser hubs, the rest fill the whole country.

// India mainland + NE outline (lat, lng), walked around the perimeter.
const IN_POLY = [
  [32.7, 74.6], [32.3, 76.4], [30.3, 78.9], [28.9, 80.4], [27.5, 83.6],
  [26.9, 88.1], [26.8, 89.9], [27.1, 92.6], [24.6, 92.6], [23.6, 91.2],
  [22.9, 88.9], [21.4, 87.0], [19.3, 84.9], [16.2, 81.3], [13.1, 80.3],
  [11.9, 79.8], [9.3, 79.2], [8.1, 77.5], [9.9, 76.2], [12.9, 74.8],
  [15.5, 73.7], [19.0, 72.8], [20.7, 70.9], [22.4, 69.0], [23.9, 68.2],
  [24.5, 71.0], [27.8, 70.2], [30.0, 74.0],
];
const IN_BBOX = { latMin: 8.0, latMax: 33.0, lngMin: 68.0, lngMax: 93.0 };

// Metros (lat, lng) that get an extra concentration of accounts.
const METROS = [
  [28.61, 77.21], // Delhi
  [19.10, 72.90], // Mumbai
  [12.97, 77.59], // Bengaluru
  [13.05, 80.20], // Chennai
  [22.57, 88.30], // Kolkata
  [17.38, 78.49], // Hyderabad
  [18.52, 73.86], // Pune
  [23.02, 72.60], // Ahmedabad
  [26.91, 75.79], // Jaipur
  [26.85, 80.95], // Lucknow
  [21.15, 79.09], // Nagpur
  [23.26, 77.41], // Bhopal
];
const METRO_SHARE = 0.42; // fraction of Indian accounts clustered at a metro
const METRO_SPREAD = 0.32; // ~35 km jitter around the metro centre

// Singapore main-island outline (lat, lng).
const SG_POLY = [
  [1.47, 103.76], [1.46, 103.86], [1.42, 103.99], [1.32, 104.02],
  [1.25, 103.90], [1.23, 103.79], [1.26, 103.66], [1.34, 103.61], [1.43, 103.66],
];
const SG_BBOX = { latMin: 1.22, latMax: 1.48, lngMin: 103.6, lngMax: 104.05 };

// FNV-1a with a murmur3 finalizer. The finalizer + a front-loaded salt make
// calls that differ only by a "lat"/"lng" prefix fully independent — without it
// the outputs stay correlated and every point collapses onto one diagonal.
function rand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // 0..1
}

function pointInPoly(poly, lat, lng) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const cache = new Map();

export function geoFor(node) {
  const id = node.id;
  const hit = cache.get(id);
  if (hit) return hit;

  let g;
  if (node.country === "SG") {
    let lat = 1.35;
    let lng = 103.82;
    for (let k = 0; k < 48; k++) {
      const cLat = SG_BBOX.latMin + rand(`sglat|${id}|${k}`) * (SG_BBOX.latMax - SG_BBOX.latMin);
      const cLng = SG_BBOX.lngMin + rand(`sglng|${id}|${k}`) * (SG_BBOX.lngMax - SG_BBOX.lngMin);
      if (pointInPoly(SG_POLY, cLat, cLng)) {
        lat = cLat;
        lng = cLng;
        break;
      }
    }
    g = { lat, lng };
  } else if (rand(`bias|${id}`) < METRO_SHARE) {
    // clustered around a metro
    const m = METROS[Math.floor(rand(`metro|${id}`) * METROS.length) % METROS.length];
    let lat = m[0];
    let lng = m[1];
    for (let k = 0; k < 16; k++) {
      const cLat = m[0] + (rand(`mlat|${id}|${k}`) - 0.5) * 2 * METRO_SPREAD;
      const cLng = m[1] + (rand(`mlng|${id}|${k}`) - 0.5) * 2 * METRO_SPREAD;
      if (pointInPoly(IN_POLY, cLat, cLng)) {
        lat = cLat;
        lng = cLng;
        break;
      }
    }
    g = { lat, lng };
  } else {
    // uniform over the whole country
    let lat = 22.5;
    let lng = 79.0;
    for (let k = 0; k < 60; k++) {
      const cLat = IN_BBOX.latMin + rand(`inlat|${id}|${k}`) * (IN_BBOX.latMax - IN_BBOX.latMin);
      const cLng = IN_BBOX.lngMin + rand(`inlng|${id}|${k}`) * (IN_BBOX.lngMax - IN_BBOX.lngMin);
      if (pointInPoly(IN_POLY, cLat, cLng)) {
        lat = cLat;
        lng = cLng;
        break;
      }
    }
    g = { lat, lng };
  }

  cache.set(id, g);
  return g;
}
