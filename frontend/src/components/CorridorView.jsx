import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { riskColor } from "../risk";
import { geoFor } from "../geo";
import { IndiaFlag, SingaporeFlag } from "./Flags";

const PRE_REVEAL_RISK = 12;
const IN_ANCHOR = [30.8, 79.0]; // India flag pins above the cluster
const SG_ANCHOR = [1.352, 103.82]; // Singapore flag pins below the island
// frames India across the top, Singapore with room to breathe near the bottom
const BOUNDS = L.latLngBounds([35.5, 67.5], [-4.8, 108.5]);

function qbez(a, c, b, u) {
  const m = 1 - u;
  return m * m * a + 2 * m * u * c + u * u * b;
}

export default function CorridorView({ view, metaRef, onNodeClick, onBgClick }) {
  const mapElRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const viewRef = useRef(view);
  const projRef = useRef(new Map()); // id -> {x,y}, cleared on reframe/resize
  const [flags, setFlags] = useState(null);
  const [ready, setReady] = useState(false);

  viewRef.current = view;

  // ---- init the locked satellite map once ----
  useEffect(() => {
    const map = L.map(mapElRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      inertia: false,
      zoomSnap: 0,
    });
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 12, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
    ).addTo(map);
    mapRef.current = map;

    const reframe = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(BOUNDS, { animate: false, padding: [8, 8] });
      projRef.current.clear();
      const inPt = map.latLngToContainerPoint(IN_ANCHOR);
      const sgPt = map.latLngToContainerPoint(SG_ANCHOR);
      setFlags({ in: inPt, sg: sgPt });
    };
    reframe();
    setReady(true);

    const ro = new ResizeObserver(reframe);
    ro.observe(mapElRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- size the overlay canvas to the map ----
  useEffect(() => {
    if (!ready) return;
    const cv = canvasRef.current;
    const fit = () => {
      const r = mapElRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = r.width + "px";
      cv.style.height = r.height + "px";
      cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(mapElRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // ---- render loop: arcs + nodes drawn over the satellite tiles ----
  useEffect(() => {
    if (!ready) return;
    const ctx = canvasRef.current.getContext("2d");
    let raf;

    const project = (node) => {
      let p = projRef.current.get(node.id);
      if (!p) {
        const g = geoFor(node);
        p = mapRef.current.latLngToContainerPoint([g.lat, g.lng]);
        projRef.current.set(node.id, p);
      }
      return p;
    };

    const draw = () => {
      const map = mapRef.current;
      const v = viewRef.current;
      const meta = metaRef.current || {};
      const detected = meta.detected || new Set();
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      const byId = new Map(v.nodes.map((n) => [n.id, n]));
      const now = performance.now();

      // 1. ring-internal same-country links (structure, drawn faint)
      for (const l of v.links) {
        if (l.cross) continue;
        if (!(l.ring && detected.has(l.ring))) continue;
        const s = byId.get(typeof l.source === "object" ? l.source.id : l.source);
        const t = byId.get(typeof l.target === "object" ? l.target.id : l.target);
        if (!s || !t) continue;
        const a = project(s);
        const b = project(t);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(255,77,94,0.28)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 2. cross-border arcs — always flowing India -> Singapore
      for (const l of v.links) {
        if (!l.cross) continue;
        const s = byId.get(typeof l.source === "object" ? l.source.id : l.source);
        const t = byId.get(typeof l.target === "object" ? l.target.id : l.target);
        if (!s || !t) continue;
        // orient so the flow always runs from the India end to the SG end
        const fromIN = s.country === "IN" ? s : t;
        const toSG = s.country === "IN" ? t : s;
        const A = project(fromIN);
        const B = project(toSG);

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy) || 1;
        let px = -dy / dist;
        let py = dx / dist;
        if (px < 0) {
          px = -px;
          py = -py;
        } // bow eastward over the bay
        const bow = dist * 0.16 + 24;
        const cx = (A.x + B.x) / 2 + px * bow;
        const cy = (A.y + B.y) / 2 + py * bow;

        const active = l.ring && detected.has(l.ring);
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(cx, cy, B.x, B.y);
        ctx.strokeStyle = active ? "rgba(255,90,80,0.75)" : "rgba(245,197,66,0.5)";
        ctx.lineWidth = active ? 2 : 1.2;
        ctx.shadowColor = active ? "rgba(255,77,94,0.7)" : "rgba(245,197,66,0.45)";
        ctx.shadowBlur = active ? 10 : 5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // particles marching one way: India -> Singapore
        const seed = (parseInt((l.id || "").replace(/\D/g, "").slice(-4) || "0", 10) % 100) / 100;
        const nP = active ? 4 : 2;
        for (let k = 0; k < nP; k++) {
          const u = (now / 2200 + seed + k / nP) % 1;
          const x = qbez(A.x, cx, B.x, u);
          const y = qbez(A.y, cy, B.y, u);
          ctx.beginPath();
          ctx.arc(x, y, active ? 2.6 : 1.9, 0, 2 * Math.PI);
          ctx.fillStyle = active ? "#ff9a70" : "#ffd766";
          ctx.shadowColor = active ? "rgba(255,120,90,0.95)" : "rgba(255,214,102,0.9)";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 3. nodes
      for (const n of v.nodes) {
        const p = project(n);
        const ringOn = n.ring && detected.has(n.ring);
        const score = n.ring && !ringOn ? PRE_REVEAL_RISK : n.risk;
        const color = riskColor(score);
        let r = ringOn ? (n.hub ? 6.5 : 4) : 2.4 + Math.min(2, (n.in_deg + n.out_deg) * 0.15);

        if (ringOn) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 260 + p.x);
          const age = (now - (meta.ringsById?.[n.ring]?.detectedAt ?? 0)) / 1000;
          if (age < 3) {
            const w = (age % 1.1) / 1.1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r + w * 22, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255,77,94,${(0.5 * (1 - w)).toFixed(3)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.shadowColor = "rgba(255,77,94,0.9)";
          ctx.shadowBlur = (n.hub ? 20 : 11) + pulse * 7;
          r += pulse * (n.hub ? 1.4 : 0.7);
        } else if (score >= 40) {
          ctx.shadowColor = "rgba(245,185,66,0.5)";
          ctx.shadowBlur = 7;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.strokeStyle =
          n.country === "SG" ? "rgba(122,162,255,0.9)" : "rgba(255,255,255,0.35)";
        ctx.lineWidth = n.country === "SG" ? 1.3 : 0.8;
        ctx.stroke();

        if (
          ringOn &&
          meta.selected?.type === "ring" &&
          meta.selected.id === n.ring
        ) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 4, 0, 2 * Math.PI);
          ctx.setLineDash([3, 2]);
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (n.hub && ringOn) {
          ctx.font = "600 10px ui-monospace, Consolas, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,214,214,0.98)";
          ctx.fillText("HUB", p.x, p.y - r - 5);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, metaRef]);

  // ---- click hit-testing against projected nodes ----
  const onClick = (e) => {
    const map = mapRef.current;
    if (!map) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null;
    let bestD = Infinity;
    for (const n of viewRef.current.nodes) {
      const g = geoFor(n);
      const p = map.latLngToContainerPoint([g.lat, g.lng]);
      const d = Math.hypot(p.x - mx, p.y - my);
      const reach = n.ring ? 18 : 12; // flagged nodes get a bigger hit target
      if (d <= reach && d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (best) onNodeClick(best);
    else onBgClick();
  };

  return (
    <div className="corridor-view">
      <div className="corridor-map" ref={mapElRef} />
      <canvas className="corridor-canvas" ref={canvasRef} onClick={onClick} />
      {flags && (
        <>
          <div
            className="geo-flag geo-flag-in"
            style={{ left: flags.in.x, top: 96 }}
          >
            <IndiaFlag className="flag-img" />
            <span>INDIA · UPI</span>
          </div>
          <div
            className="geo-flag geo-flag-sg"
            style={{ left: flags.sg.x, top: flags.sg.y }}
          >
            <span>SINGAPORE · PayNow</span>
            <SingaporeFlag className="flag-img" />
          </div>
        </>
      )}
    </div>
  );
}
