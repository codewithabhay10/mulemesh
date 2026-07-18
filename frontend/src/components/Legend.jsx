export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-row">
        <span className="dot" style={{ background: "#2dd4a7" }} /> low risk
      </div>
      <div className="legend-row">
        <span className="dot" style={{ background: "#f5b942" }} /> elevated
      </div>
      <div className="legend-row">
        <span className="dot glow" style={{ background: "#ff4d5e" }} /> flagged
        ring
      </div>
      <div className="legend-row">
        <span className="dash" /> cross-border IN→SG
      </div>
      <div className="legend-row">
        <span className="dot sg" /> SG account (blue rim)
      </div>
    </div>
  );
}
