import { C } from "../constants.js";

export default function SliderInput({
  label: lbl,
  value,
  onChange,
  min,
  max,
  step,
  color = C.teal,
  format,
  hint,
  dataVal,
}) {
  const pct = ((value - min) / (max - min) * 100).toFixed(1);
  const fmt = format ? format(value) : value;
  const dataFmt = dataVal !== undefined ? (format ? format(dataVal) : dataVal) : null;
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.8px" }}>{lbl}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dataFmt != null && (
            <span
              style={{ fontSize: 10, color: C.dim, cursor: "pointer" }}
              title="Click to reset to data value"
              onClick={() => onChange(dataVal)}
            >
              DATA: <span style={{ color: C.muted }}>{dataFmt}</span>
            </span>
          )}
          <input
            type="number"
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            style={{
              background: C.dim,
              border: `1px solid ${color}44`,
              borderRadius: 4,
              color,
              padding: "2px 6px",
              fontSize: 12,
              width: 72,
              textAlign: "right",
              fontFamily: "'IBM Plex Mono',monospace",
              outline: "none",
            }}
          />
        </div>
      </div>
      <div style={{ position: "relative", height: 4, background: C.dim, borderRadius: 2 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: "width .1s",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            position: "absolute",
            top: -6,
            left: 0,
            width: "100%",
            opacity: 0,
            cursor: "pointer",
            height: 16,
          }}
        />
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  );
}
