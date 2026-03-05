import { C } from "../constants.js";

export default function ChartTT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border2}`,
        borderRadius: 6,
        padding: "10px 14px",
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 11,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <span style={{ color: C.muted }}>{p.name}: </span>
          <span style={{ color: p.color || C.white, fontWeight: 600 }}>
            ${typeof p.value === "number" ? p.value.toFixed(1) : p.value}B
          </span>
        </div>
      ))}
    </div>
  );
}
