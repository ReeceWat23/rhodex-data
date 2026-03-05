import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { C, FEAR_MULT } from "../constants.js";
import ChartTT from "../components/ChartTT.jsx";

export default function MarketTab({
  card,
  pill,
  src,
  annualData,
  chartMode,
  setChartMode,
  activeTypes,
  simDone,
  nSim,
  histData,
  exceedance,
  pctTable,
  TYPE_C,
  disType,
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px" }}>
            ANNUAL LOSSES — {disType === "All" ? "ALL" : disType.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["aggregate", "perType"].map((m) => (
              <button key={m} style={pill(chartMode === m, C.teal)} onClick={() => setChartMode(m)}>
                {m === "aggregate" ? "TOTAL" : "BY TYPE"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          {chartMode === "aggregate" ? (
            <AreaChart data={annualData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={src.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={src.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
              <XAxis dataKey="year" stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
              <Tooltip content={<ChartTT />} />
              {[100, 200, 300].map((v, i) => (
                <ReferenceLine
                  key={v}
                  y={v}
                  stroke={[C.rose, C.lavender, C.green][i]}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: `$${v}B`, fill: [C.rose, C.lavender, C.green][i], fontSize: 9, position: "insideTopRight" }}
                />
              ))}
              <Area type="monotone" dataKey="total" stroke={src.color} strokeWidth={1.5} fill="url(#g1)" name="Loss" />
            </AreaChart>
          ) : (
            <BarChart data={annualData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
              <XAxis dataKey="year" stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
              <Tooltip content={<ChartTT />} />
              <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
              {activeTypes.map((t) => (
                <Bar key={t} dataKey={t} stackId="s" fill={TYPE_C[t] || C.teal} name={t} opacity={0.85} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {simDone ? (
          <>
            <div style={card()}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>
                LOSS DISTRIBUTION — {nSim.toLocaleString()} SIMULATED YEARS
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={histData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
                  <XAxis dataKey="bin" stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} interval={9} tickFormatter={(v) => `$${v}B`} />
                  <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={32} />
                  <Tooltip formatter={(v, n) => [`${v.toFixed(3)}%`, n]} contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} />
                  <Bar dataKey="freq" name="Frequency" radius={[1, 1, 0, 0]}>
                    {histData.map((_, i) => (
                      <Cell key={i} fill={i < histData.length * 0.65 ? C.teal : i < histData.length * 0.88 ? C.lavender : C.rose} fillOpacity={0.78} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={card()}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>EXCEEDANCE CURVE</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={exceedance} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
                  <XAxis dataKey="threshold" stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `$${v}B`} interval={5} />
                  <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={32} />
                  <Tooltip formatter={(v) => [`${v.toFixed(3)}%`]} contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} />
                  <Line dataKey="true" stroke={C.teal} strokeWidth={1.5} dot={false} name="True" />
                  <Line dataKey="implied" stroke={C.rose} strokeWidth={1} strokeDasharray="4 3" dot={false} name="Implied" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10 }}>
                <span><span style={{ color: C.teal }}>—</span> <span style={{ color: C.muted }}>True prob</span></span>
                <span><span style={{ color: C.rose }}>- -</span> <span style={{ color: C.muted }}>Implied ({FEAR_MULT}× fear)</span></span>
              </div>
            </div>
            <div style={card()}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>RETURN PERIOD</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border2}` }}>
                    {["PERCENTILE", "RETURN YR", "LOSS ($B)"].map((h) => (
                      <th key={h} style={{ padding: "4px 10px", color: C.muted, fontWeight: 500, textAlign: "right", fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pctTable.map((r) => (
                    <tr key={r.pct} style={{ borderBottom: `1px solid ${C.dim}` }}>
                      <td style={{ padding: "5px 10px", color: C.muted, textAlign: "right" }}>{r.pct}th</td>
                      <td style={{ padding: "5px 10px", color: C.muted, textAlign: "right" }}>{r.returnYr} yr</td>
                      <td style={{ padding: "5px 10px", color: C.teal, textAlign: "right", fontWeight: 600 }}>${r.val.toLocaleString()}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ ...card(), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 320 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 20 }}>⟳</div>
            <div style={{ color: C.muted, fontSize: 11, textAlign: "center", lineHeight: 1.8 }}>
              Configure MC parameters above<br />then run simulation
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
