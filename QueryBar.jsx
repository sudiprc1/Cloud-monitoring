import { useState } from "react";
import axios from "axios";

const SUGGESTIONS = [
  "Show me all public S3 buckets",
  "Find critical risks",
  "Show Lambda functions and IAM roles",
  "Find attack paths from EC2 to IAM",
  "Show everything",
];

export default function QueryBar({ onResult, onLoading }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (q) => {
    const text = q || query;
    if (!text.trim()) return;
    setLoading(true);
    onLoading(true);
    setError(null);
    try {
      const res = await axios.post("http://localhost:8000/query", { query: text });
      onResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Query failed");
    } finally {
      setLoading(false);
      onLoading(false);
    }
  };

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-tertiary, #eee)" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder='Ask anything — "show public S3 buckets" or "find attack paths"'
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border-secondary, #ccc)",
            fontSize: 14,
            background: "var(--color-background-secondary, #f9f9f9)",
            color: "var(--color-text-primary, #222)",
          }}
        />
        <button
          onClick={() => submit()}
          disabled={loading}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "none",
            background: "#534AB7",
            color: "#fff",
            fontSize: 14,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {/* Suggestion chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => { setQuery(s); submit(s); }}
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid var(--color-border-tertiary, #ddd)",
              background: "transparent",
              fontSize: 12,
              cursor: "pointer",
              color: "var(--color-text-secondary, #555)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#E24B4A" }}>
          {error}
        </div>
      )}
    </div>
  );
}
