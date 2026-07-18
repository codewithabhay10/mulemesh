import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { riskColor } from "../risk";

const PRE_REVEAL_RISK = 12; // mule nodes look calm until their ring is detected

function hashPhase(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

export default function GraphView({ view, metaRef, onNodeClick, onBgClick, phase }) {
  const fgRef = useRef();
  const wrapRef = useRef();
  const fitDone = useRef(false);
  const [dims, setDims] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() =>
      setDims({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // camera follows the growing graph during playback, settles when done
  useEffect(() => {
    if (!fgRef.current) return;
    if (phase === "playing") {
      fgRef.current.zoomToFit(600, 90);
      const iv = setInterval(() => fgRef.current?.zoomToFit(1100, 90), 1500);
      return () => clearInterval(iv);
    }
    if (phase === "done") {
      const t = setTimeout(() => fgRef.current?.zoomToFit(900, 70), 350);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const paintNode = useCallback(
    (node, ctx, scale) => {
      const meta = metaRef.current;
      const ring =
        node.ring && meta.detected.has(node.ring)
          ? meta.ringsById[node.ring]
          : null;
      const score = node.ring && !ring ? PRE_REVEAL_RISK : node.risk;
      const color = riskColor(score);
      const base = ring
        ? node.hub
          ? 9
          : 5.5
        : 3 + Math.min(2.5, (node.in_deg + node.out_deg) * 0.18);
      let r = base;

      if (ring) {
        const now = performance.now();
        const age = (now - (ring.detectedAt ?? 0)) / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(now / 260 + hashPhase(node.id) * 6.28);
        if (age < 3) {
          // detection shockwave
          const w = (age % 1.1) / 1.1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + w * 26, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(255,77,94,${(0.55 * (1 - w)).toFixed(3)})`;
          ctx.lineWidth = 2 / scale;
          ctx.stroke();
        }
        ctx.shadowColor = "rgba(255,77,94,0.85)";
        ctx.shadowBlur = (node.hub ? 26 : 14) + pulse * 8;
        r = base + pulse * (node.hub ? 1.6 : 0.8);
      } else if (score >= 40) {
        ctx.shadowColor = "rgba(245,185,66,0.5)";
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // country marker: SG accounts get a cool blue outline
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.strokeStyle =
        node.country === "SG"
          ? "rgba(122,162,255,0.85)"
          : "rgba(255,255,255,0.15)";
      ctx.lineWidth = (node.country === "SG" ? 1.4 : 1) / scale;
      ctx.stroke();

      // selected-ring halo
      if (
        ring &&
        meta.selected?.type === "ring" &&
        meta.selected.id === node.ring
      ) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI);
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.3 / scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (node.hub && ring && scale > 0.8) {
        ctx.font = `600 ${Math.max(3, 9 / scale)}px ui-monospace, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,214,214,0.95)";
        ctx.fillText("HUB", node.x, node.y - r - 4 / scale);
      }
    },
    [metaRef],
  );

  const paintPointer = useCallback((node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    // generous hit target — flagged hubs get the biggest
    ctx.arc(node.x, node.y, node.ring ? 16 : 11, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const paintLink = useCallback(
    (link, ctx, scale) => {
      const meta = metaRef.current;
      const s = link.source;
      const t = link.target;
      if (typeof s !== "object" || s.x == null || t.x == null) return;
      const ringActive = link.ring && meta.detected.has(link.ring);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      if (link.cross) {
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = ringActive
          ? "rgba(255,148,84,0.85)"
          : "rgba(245,197,66,0.5)";
        ctx.lineWidth = 1.4 / scale;
      } else if (ringActive) {
        ctx.strokeStyle = "rgba(255,77,94,0.5)";
        ctx.lineWidth = 1.3 / scale;
      } else {
        ctx.strokeStyle = "rgba(148,163,184,0.16)";
        ctx.lineWidth = 1 / scale;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (link.cross) {
        // animated gold particle drifting along the IN→SG corridor
        const seed = hashPhase(link.id);
        const p = (performance.now() / 1800 + seed) % 1;
        const x = s.x + (t.x - s.x) * p;
        const y = s.y + (t.y - s.y) * p;
        ctx.beginPath();
        ctx.arc(x, y, 1.7 / Math.sqrt(scale), 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,214,102,0.95)";
        ctx.shadowColor = "rgba(255,214,102,0.9)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    [metaRef],
  );

  const nodeTooltip = useCallback(
    (n) => {
      const meta = metaRef.current;
      const hidden = n.ring && !meta.detected.has(n.ring);
      const score = hidden ? "—" : n.risk;
      const geo = n.country === "IN" ? "India · UPI" : "Singapore · PayNow";
      const ringTag = n.ring && !hidden ? ` · ${n.ring}` : "";
      return `<div class="tt"><div class="tt-id">${n.id}</div><div>${geo}</div><div>risk <b>${score}</b>${ringTag} · in ${n.in_deg} / out ${n.out_deg}</div></div>`;
    },
    [metaRef],
  );

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <ForceGraph2D
        ref={fgRef}
        width={dims.w}
        height={dims.h}
        graphData={view}
        backgroundColor="rgba(0,0,0,0)"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointer}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => "replace"}
        nodeLabel={nodeTooltip}
        onNodeClick={onNodeClick}
        onBackgroundClick={onBgClick}
        cooldownTime={4000}
        d3AlphaDecay={0.035}
        d3VelocityDecay={0.35}
        autoPauseRedraw={false}
        onEngineStop={() => {
          if (!fitDone.current && fgRef.current) {
            fitDone.current = true;
            fgRef.current.zoomToFit(700, 70);
          }
        }}
      />
    </div>
  );
}
