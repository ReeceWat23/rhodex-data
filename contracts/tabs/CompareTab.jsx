import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { C } from "../constants.js";

export default function CompareTab({ comparison = [], card = () => ({}) }) {
  const cardStyle = typeof card === "function" ? card() : card;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 14 }}>
          ALL SOURCES vs INDUSTRY (2000–2024)
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={comparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
            <XAxis dataKey="year" stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} interval={3} />
            <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
            <Tooltip
              contentStyle={{
                background: C.panel,
                border: `1px solid ${C.border2}`,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono',monospace",
              }}
              formatter={(v, n) => [`$${v}B`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
            <Line dataKey="industry" stroke={C.white} strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Industry" />
            <Line dataKey="smart" stroke={C.teal} strokeWidth={2} dot={false} name="Smart Adj" />
            <Line dataKey="owid" stroke={C.sage} strokeWidth={1.5} dot={false} name="OWID" />
            <Line dataKey="emdat" stroke={C.rose} strokeWidth={1.2} dot={false} name="EM-DAT" />
            <Line dataKey="calibrated" stroke={C.lavender} strokeWidth={1.2} strokeDasharray="3 3" dot={false} name="Calibrated" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 14 }}>
          ADJUSTMENT METHODOLOGY
        </div>
        {[
          { years: "2000–2001", regime: "Structural Gap", mult: "~3.0×", color: C.rose, desc: "Early EM-DAT had poor coverage of developing-country events." },
          { years: "2002–2012", regime: "Well Calibrated", mult: "1.05×", color: C.sage, desc: "OWID closely tracks industry consensus." },
          { years: "2013–2021", regime: "Mild Correction", mult: "1.15×", color: C.lavender, desc: "Growing gap in uninsured loss estimation." },
          { years: "2022+", regime: "Reporting Lag", mult: "1.05–1.45×", color: C.teal, desc: "Decays ~0.25× per year as events are filed." },
        ].map((r) => (
          <div
            key={r.years}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 0",
              borderBottom: `1px solid ${C.dim}`,
            }}
          >
            <div style={{ minWidth: 80, fontSize: 10, color: r.color, fontWeight: 600 }}>{r.years}</div>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontSize: 12, color: C.white }}>{r.regime}</span>
                <span style={{ fontSize: 11, color: r.color }}>×{r.mult}</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
