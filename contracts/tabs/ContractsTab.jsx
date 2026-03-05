import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { C, FEAR_MULT } from "../constants.js";

export default function ContractsTab({
  card,
  pill,
  numInp,
  simDone,
  contracts = [],
  riskMults,
  setRiskMults,
  globalMult,
  setGlobalMult,
  setStrikes,
  applyGlobal,
  customStrike,
  setCustomStrike,
  addStrike,
}) {
  return (
    <div>
      <div style={{ ...card(), marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 12 }}>
          RISK LOAD CONTROLS
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>GLOBAL MULT</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={globalMult}
              onChange={(e) => setGlobalMult(parseFloat(e.target.value) || 2.5)}
              style={{ ...numInp(70), color: C.teal }}
            />
            <button onClick={applyGlobal} style={pill(false, C.teal)}>APPLY ALL</button>
          </div>
          <div style={{ width: 1, height: 24, background: C.border }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>ADD STRIKE $</span>
            <input
              type="number"
              value={customStrike}
              onChange={(e) => setCustomStrike(e.target.value)}
              placeholder="e.g. 5000"
              style={numInp(110)}
              onKeyDown={(e) => e.key === "Enter" && addStrike()}
            />
            <button onClick={addStrike} style={pill(false, C.sage)}>+ ADD</button>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.muted }}>
            FEAR MULT <span style={{ color: C.lavender }}>{FEAR_MULT}×</span>
          </div>
        </div>
      </div>
      {!simDone ? (
        <div style={{ ...card(), textAlign: "center", padding: "32px", color: C.muted, fontSize: 12 }}>
          Run simulation on Market tab first
        </div>
      ) : (
        <div style={card()}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 14 }}>
            CONTRACT BOOK
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border2}` }}>
                  {["STRIKE", "TRUE PROB", "IMPLIED", "RISK MULT", "PURE PREM", "RISK PREM", "GAP", "EDGE", ""].map((h) => (
                    <th key={h} style={{ padding: "7px 12px", color: C.muted, fontWeight: 500, textAlign: "right", fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const ec = c.edge === "Strong" ? C.sage : c.edge === "Moderate" ? C.lavender : C.muted;
                  return (
                    <tr
                      key={c.strike}
                      style={{ borderBottom: `1px solid ${C.dim}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.dim)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#c4956a", textAlign: "right", fontWeight: 700 }}>${c.strike.toLocaleString()}B</td>
                      <td style={{ padding: "8px 12px", color: C.sage, textAlign: "right" }}>{c.trueP.toFixed(3)}%</td>
                      <td style={{ padding: "8px 12px", color: C.rose, textAlign: "right" }}>{c.implP.toFixed(3)}%</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          value={riskMults[c.strike] ?? globalMult}
                          onChange={(e) => setRiskMults((m) => ({ ...m, [c.strike]: parseFloat(e.target.value) || globalMult }))}
                          style={{ ...numInp(60), color: C.teal }}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", color: C.text, textAlign: "right" }}>{c.pure.toFixed(3)}%</td>
                      <td style={{ padding: "8px 12px", color: C.teal, textAlign: "right", fontWeight: 600 }}>{c.risk.toFixed(3)}%</td>
                      <td style={{ padding: "8px 12px", color: C.lavender, textAlign: "right", fontWeight: 600 }}>+{c.gap.toFixed(2)}pp</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: ec, fontSize: 11 }}>
                        {c.edge === "Strong" ? "▲ Strong" : c.edge === "Moderate" ? "→ Mod" : "▽ Thin"}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <button
                          onClick={() => setStrikes((s) => s.filter((x) => x !== c.strike))}
                          style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}
                        >×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={155}>
              <BarChart data={contracts} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
                <XAxis dataKey="strike" stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
                <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
                  formatter={(v, n) => [`${v.toFixed(3)}%`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
                <Bar dataKey="trueP" name="True Prob" fill={C.sage} opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="risk" name="Premium" fill={C.teal} opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="gap" name="Gap" fill={C.lavender} opacity={0.75} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
