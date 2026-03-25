const SEVERITY_COLOR = {
  critical: "#E24B4A",
  high:     "#EF9F27",
  medium:   "#378ADD",
  low:      "#1D9E75",
};

export default function AttackOverlay({ paths, onToggle, active }) {
  if (!paths || paths.length === 0) return null;

  return (
    <div style={{
      width: 300,
      background: "var(--color-background-secondary, #fff)",
      borderLeft: "1px solid var(--color-border-tertiary, #eee)",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border-tertiary, #eee)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>
          Attack paths ({paths.length})
        </span>
        <button
          onClick={onToggle}
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            border: "1px solid var(--color-border-secondary, #ccc)",
            background: active ? "#E24B4A" : "transparent",
            color: active ? "#fff" : "var(--color-text-secondary)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {active ? "Hide on graph" : "Show on graph"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {paths.map((ap, i) => (
          <div
            key={i}
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border-tertiary, #eee)",
              borderLeft: `3px solid ${SEVERITY_COLOR[ap.severity] || "#888"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: SEVERITY_COLOR[ap.severity],
                textTransform: "uppercase",
              }}>
                {ap.severity}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary, #999)" }}>
                {ap.hops} hop{ap.hops !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary, #555)", lineHeight: 1.5 }}>
              {ap.description}
            </div>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
              {ap.path.map((node, j) => (
                <span key={j} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{
                    fontSize: 10,
                    background: "var(--color-background-tertiary, #f5f5f5)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: "var(--color-text-secondary)",
                    maxWidth: 80,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {node.length > 12 ? node.slice(-10) : node}
                  </span>
                  {j < ap.path.length - 1 && (
                    <span style={{ fontSize: 10, color: "#E24B4A" }}>→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
