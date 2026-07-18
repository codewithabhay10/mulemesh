export async function fetchGraph() {
  const r = await fetch("/api/graph");
  if (!r.ok) throw new Error(`graph fetch failed: ${r.status}`);
  return r.json();
}

export async function fetchSar(ringId, llm) {
  const r = await fetch(`/api/sar/${ringId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ llm }),
  });
  if (!r.ok) throw new Error(`sar fetch failed: ${r.status}`);
  return r.json();
}
