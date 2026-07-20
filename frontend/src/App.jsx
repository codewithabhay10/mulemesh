import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGraph } from "./api";
import GraphView from "./components/GraphView";
import CorridorView from "./components/CorridorView";
import TopBar from "./components/TopBar";
import SidePanel from "./components/SidePanel";
import Toasts from "./components/Toasts";
import Legend from "./components/Legend";
import Splash from "./components/Splash";

const PLAY_MS = 15000;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [tick, setTick] = useState(0);
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState(null); // {type:"ring"|"node", id}
  const [viewMode, setViewMode] = useState("corridor"); // corridor | network
  const [showSplash, setShowSplash] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const playRef = useRef({ t: -Infinity, startedAt: 0 });
  const metaRef = useRef({}); // read by canvas paint callbacks every frame
  const bootAt = useRef(performance.now());

  useEffect(() => {
    fetchGraph().then(setData).catch((e) => setError(String(e)));
  }, []);

  // hold the intro ~2.6s (and until data + tiles are loading), then open
  useEffect(() => {
    if (!data) return;
    const wait = Math.max(0, 2600 - (performance.now() - bootAt.current));
    const t = setTimeout(() => setSplashLeaving(true), wait);
    return () => clearTimeout(t);
  }, [data]);

  useEffect(() => {
    if (!splashLeaving) return;
    const t = setTimeout(() => setShowSplash(false), 850); // matches CSS fade
    return () => clearTimeout(t);
  }, [splashLeaving]);

  const streamTs = useMemo(() => {
    if (!data) return { min: 0, max: 1 };
    const ts = data.links.filter((l) => l.phase === "stream").map((l) => l.ts);
    return { min: Math.min(...ts) - 1, max: Math.max(...ts) + 1 };
  }, [data]);

  const ringsById = useMemo(() => {
    const m = {};
    (data?.rings ?? []).forEach((r) => (m[r.id] = r));
    return m;
  }, [data]);

  const nodesById = useMemo(() => {
    const m = {};
    (data?.nodes ?? []).forEach((n) => (m[n.id] = n));
    return m;
  }, [data]);

  function play() {
    if (!data) return;
    setDetected([]);
    setSelected(null);
    Object.values(ringsById).forEach((r) => delete r.detectedAt);
    playRef.current = { t: streamTs.min, startedAt: performance.now() };
    setPhase("playing");
  }

  // playback clock: maps the synthetic 6h window onto PLAY_MS of wall time
  useEffect(() => {
    if (phase !== "playing") return;
    let raf;
    let last = 0;
    const step = (now) => {
      const p = Math.min(1, (now - playRef.current.startedAt) / PLAY_MS);
      playRef.current.t = streamTs.min + p * (streamTs.max - streamTs.min);
      if (now - last > 250) {
        last = now;
        setTick((x) => x + 1);
      }
      if (p >= 1) {
        playRef.current.t = Infinity;
        setPhase("done");
        setTick((x) => x + 1);
      } else {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, streamTs]);

  // flag rings as the playhead crosses each ring's completion timestamp
  useEffect(() => {
    if (!data || phase === "idle") return;
    const t = phase === "done" ? Infinity : playRef.current.t;
    const newly = data.rings.filter(
      (r) => r.reveal_ts <= t && !detected.includes(r.id),
    );
    if (newly.length) {
      newly.forEach((r) => (r.detectedAt = performance.now()));
      setDetected((d) => [...d, ...newly.map((r) => r.id)]);
    }
  }, [tick, phase, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // visible slice of the graph for the current playhead
  const view = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const t =
      phase === "idle" ? -Infinity : phase === "done" ? Infinity : playRef.current.t;
    const links = data.links.filter((l) => l.phase === "baseline" || l.ts <= t);
    const seen = new Set();
    links.forEach((l) => {
      seen.add(typeof l.source === "object" ? l.source.id : l.source);
      seen.add(typeof l.target === "object" ? l.target.id : l.target);
    });
    const nodes = data.nodes.filter(
      (n) => n.phase === "baseline" || seen.has(n.id),
    );
    return { nodes, links };
  }, [data, tick, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectedSet = useMemo(() => new Set(detected), [detected]);
  metaRef.current = { ringsById, detected: detectedSet, selected, phase };

  const flaggedValue = detected.reduce(
    (acc, id) => acc + (ringsById[id]?.total_amount ?? 0),
    0,
  );
  const progress =
    phase === "playing"
      ? (playRef.current.t - streamTs.min) / (streamTs.max - streamTs.min)
      : phase === "done"
        ? 1
        : 0;

  if (error) {
    return (
      <div className="boot">
        <h1>MuleMesh</h1>
        <p className="boot-err">
          Could not reach the backend — is uvicorn running on :8000?
        </p>
        <code>{error}</code>
      </div>
    );
  }
  const onNodeClick = (node) => {
    if (node.ring && detectedSet.has(node.ring)) {
      setSelected({ type: "ring", id: node.ring });
    } else {
      setSelected({ type: "node", id: node.id });
    }
  };

  return (
    <div className="app">
      {data && (
        <>
      {viewMode === "corridor" ? (
        <CorridorView
          view={view}
          metaRef={metaRef}
          onNodeClick={onNodeClick}
          onBgClick={() => setSelected(null)}
        />
      ) : (
        <GraphView
          view={view}
          metaRef={metaRef}
          phase={phase}
          onNodeClick={onNodeClick}
          onBgClick={() => setSelected(null)}
        />
      )}

      <div className="view-toggle">
        <button
          className={viewMode === "corridor" ? "on" : ""}
          onClick={() => setViewMode("corridor")}
        >
          🛰 Corridor
        </button>
        <button
          className={viewMode === "network" ? "on" : ""}
          onClick={() => setViewMode("network")}
        >
          ◉ Network
        </button>
      </div>
      <TopBar
        stats={data.stats}
        detectedCount={detected.length}
        flaggedValue={flaggedValue}
        precision={phase === "done" ? data.stats.precision : null}
        recall={phase === "done" ? data.stats.recall : null}
        phase={phase}
        progress={progress}
        onPlay={play}
      />
      <Toasts
        rings={detected.map((id) => ringsById[id])}
        onOpen={(id) => setSelected({ type: "ring", id })}
      />
      <Legend />
      <SidePanel
        selected={selected}
        ringsById={ringsById}
        nodesById={nodesById}
        detectedSet={detectedSet}
        onClose={() => setSelected(null)}
      />
      {phase === "playing" && (
        <div className="live-pill">
          <span className="live-dot" /> streaming live transactions…
        </div>
      )}
        </>
      )}
      {showSplash && <Splash leaving={splashLeaving} />}
    </div>
  );
}
