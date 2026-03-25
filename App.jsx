import { useState } from "react";
import axios from "axios";
import GraphCanvas from "./GraphCanvas";
import QueryBar from "./QueryBar";
import AttackOverlay from "./AttackOverlay";

const RISK_COLOR = { critical: "#E24B4A", high: "#EF9F27", medium: "#378ADD", low: "#1D9E75" };

export default function App() {
  const [graph, setGraph]               = useState(null);
  const [attackPaths, setAttackPaths]   = useState([]);
  const [summary, setSummary]           = useState(null);
  const [scanning, setScanning]         = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [showAttacks, setShowAttacks]   = useState(false);
  const [region, setRegion]             = useState("us-east-1");
  const [error, setError]               = useState(null);
  const [filtersApplied, setFiltersApplied] = useState(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await axios.post(`http://localhost:8000/scan?region=${region}`);
      setGraph(res.data.graph);
      setSummary(res.data.summary);

      // Also load attack paths
      const apRes = await axios.get("http://localhost:8000/attack-paths");
      setAttackPaths(apRes.data.attack_paths);
    } catch (e) {
      setError(e.response?.data?.detail || "Scan failed. Is the backend running?");
    } finally {
      setScanning(false);
    }
  };

  const handleQueryResult = (data) => {
    setGraph(data.graph);
    setFiltersApplied(data.filters_applied);
  };

  const resetGraph = async () => {
    setFiltersApplied(null);
    try {
      const res = await axios.get("http://localhost:8000/graph");
      setGraph(res);
    } catch {}
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      fontFamily: "system-ui, sans-serif",
      background: "var(--color-background-primary, #fff)",
      color: "var(--color-text-primary, #222)",
    }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-border-tertiary, #eee)",
        background: "var(--color-background-secondary, #fafafa)",
      }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: "#534AB7" }}>CloudGuard</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary, #999)" }}>POC</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{
              padding: "4px 8px", borderRadius: 6, fontSize: 13,
              border: "1px solid var(--color-border-secondary, #ccc)",
              background: "var(--color-background-primary, #fff)",
              color: "var(--color-text-primary)",
            }}
          >
            {["us-east-1","us-west-2","eu-west-1","ap-southeast-1","ap-south-1"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button
            onClick={scan}
            disabled={scanning}
            style={{
              padding: "6px 16px", borderRadius: 8, border: "none",
              background: "#534AB7", color: "#fff", fontSize: 13,
              cursor: scanning ? "wait" : "pointer",
              opacity: scanning ? 0.7 : 1,
            }}
          >
            {scanning ? "Scanning…" : "Scan AWS"}
          </button>
        </div>

        {/* Summary badges */}
        {summary && (
          <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {summary.total_resources} resources
            </span>
            {Object.entries(summary.risk_counts).map(([level, count]) =>
              count > 0 && (
                <span key={level} style={{
                  padding: "2px 8px", borderRadius: 12, fontSize: 11,
                  background: RISK_COLOR[level] + "22",
                  color: RISK_COLOR[level], fontWeight: 500,
                }}>
                  {count} {level}
                </span>
              )
            )}
          </div>
        )}

        {filtersApplied && (
          <button onClick={resetGraph} style={{
            marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
            fontSize: 12, border: "1px solid var(--color-border-secondary, #ccc)",
            background: "transparent", cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}>
            Clear filter
          </button>
        )}
      </div>

      {/* NL Query bar */}
      {graph && (
        <QueryBar onResult={handleQueryResult} onLoading={setQueryLoading} />
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Graph area */}
        <div style={{ flex: 1, position: "relative" }}>
          {!graph && !scanning && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <div style={{ fontSize: 32, opacity: 0.15 }}>☁</div>
              <div style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>
                Click <strong>Scan AWS</strong> to start
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                Uses read-only AWS credentials — no changes to your infra
              </div>
            </div>
          )}

          {scanning && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
                Scanning your AWS account…
              </div>
            </div>
          )}

          {queryLoading && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              fontSize: 12, color: "var(--color-text-secondary)",
              background: "var(--color-background-secondary)",
              padding: "4px 12px", borderRadius: 20,
              border: "1px solid var(--color-border-tertiary)",
            }}>
              Querying…
            </div>
          )}

          {error && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              fontSize: 12, color: "#E24B4A",
              background: "#FCEBEB",
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid #F09595",
            }}>
              {error}
            </div>
          )}

          {graph && (
            <GraphCanvas
              graph={graph}
              attackPaths={attackPaths}
              highlightPaths={showAttacks}
            />
          )}

          {/* Legend */}
          {graph && (
            <div style={{
              position: "absolute", bottom: 16, left: 16,
              background: "var(--color-background-secondary, #fff)",
              border: "1px solid var(--color-border-tertiary, #eee)",
              borderRadius: 8, padding: "8px 12px",
              fontSize: 11, display: "flex", flexDirection: "column", gap: 4,
            }}>
              {Object.entries(RISK_COLOR).map(([level, color]) => (
                <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }}/>
                  <span style={{ color: "var(--color-text-secondary)" }}>{level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attack paths panel */}
        {attackPaths.length > 0 && (
          <AttackOverlay
            paths={attackPaths}
            active={showAttacks}
            onToggle={() => setShowAttacks(v => !v)}
          />
        )}
      </div>
    </div>
  );
}
