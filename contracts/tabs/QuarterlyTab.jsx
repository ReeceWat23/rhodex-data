import { useState, useMemo } from "react";
import {
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
  Cell,
} from "recharts";
import { C, Q_NAMES, Q_COLORS } from "../constants.js";
import { runQMC } from "../utils.js";
import { QUARTERLY_DATA } from "../data/contractsData.js";

export default function QuarterlyTab({ yearFrom = 2000, yearTo = 2024, nSim: nSimProp = 40000 }) {
  const [qOverrides, setQOverrides] = useState({ 1: {}, 2: {}, 3: {}, 4: {} });
  const [qSim, setQSim] = useState([]);
  const [qRunning, setQRunning] = useState(false);
  const [qDone, setQDone] = useState(false);
  const setQParam = (q, param, val) => setQOverrides((o) => ({ ...o, [q]: { ...o[q], [param]: parseFloat(val) || undefined } }));
  const resetQ = (q) => setQOverrides((o) => ({ ...o, [q]: {} }));

  const filteredQ = useMemo(() => QUARTERLY_DATA.filter((r) => r.year >= yearFrom && r.year <= yearTo), [yearFrom, yearTo]);

  const derivedParams = useMemo(() => {
    const out = {};
    for (const q of [1, 2, 3, 4]) {
      const vals = filteredQ.filter((r) => r.quarter === q).map((r) => r.loss_B).filter((v) => v > 0.1);
      if (!vals.length) {
        out[q] = { mu: 3.5, sig: 0.8, lam: 90, mean: 0, std: 0, n: 0 };
        continue;
      }
      const lv = vals.map((v) => Math.log(v));
      const mu = lv.reduce((a, b) => a + b, 0) / lv.length;
      const sig = Math.sqrt(lv.map((v) => (v - mu) ** 2).reduce((a, b) => a + b, 0) / lv.length);
      const evts = filteredQ.filter((r) => r.quarter === q).map((r) => r.events);
      const lam = evts.length ? evts.reduce((a, b) => a + b, 0) / evts.length : 90;
      out[q] = {
        mu: +mu.toFixed(3),
        sig: +sig.toFixed(3),
        lam: +lam.toFixed(1),
        mean: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
        std: +(Math.sqrt(vals.map((v) => (v - vals.reduce((a, b) => a + b, 0) / vals.length) ** 2).reduce((a, b) => a + b, 0) / vals.length)).toFixed(1),
        n: vals.length,
      };
    }
    return out;
  }, [filteredQ]);

  const annualQChart = useMemo(() => {
    const byYear = {};
    filteredQ.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year, Q1: 0, Q2: 0, Q3: 0, Q4: 0, total: 0 };
      byYear[r.year][`Q${r.quarter}`] = r.loss_B;
      byYear[r.year].total += r.loss_B;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [filteredQ]);

  const runQSim = () => {
    setQRunning(true);
    setQDone(false);
    setTimeout(() => {
      const qp = {};
      for (const q of [1, 2, 3, 4]) qp[q] = { ...derivedParams[q], ...qOverrides[q] };
      const res = runQMC(qp, {}, nSimProp);
      setQSim(res);
      setQDone(true);
      setQRunning(false);
    }, 60);
  };

  const qSimStats = useMemo(() => {
    if (!qSim.length) return null;
    const s = qSim.slice().sort((a, b) => a - b);
    const pct = (p) => +(s[Math.floor((p / 100) * s.length)] || 0).toFixed(1);
    return {
      mean: +(qSim.reduce((a, b) => a + b, 0) / qSim.length).toFixed(1),
      p50: pct(50),
      p75: pct(75),
      p90: pct(90),
      p95: pct(95),
      p99: pct(99),
    };
  }, [qSim]);

  const qHistData = useMemo(() => {
    if (!qSim.length) return [];
    const bins = 50,
      max = 1500,
      w = max / bins,
      counts = Array(bins).fill(0);
    qSim.filter((v) => v < max).forEach((v) => (counts[Math.min(Math.floor(v / w), bins - 1)]++));
    return counts.map((c, i) => ({ bin: Math.round(i * w), freq: +(c / qSim.length * 100).toFixed(3) }));
  }, [qSim]);

  const qScatter = useMemo(() => {
    const out = {};
    for (const q of [1, 2, 3, 4]) {
      out[q] = filteredQ.filter((r) => r.quarter === q).map((r) => ({ year: r.year, loss: r.loss_B, events: r.events }));
    }
    return out;
  }, [filteredQ]);

  const inp3 = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.text, padding: "4px 7px", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", outline: "none", width: "100%", textAlign: "center" };
  const card = (bc = C.border) => ({ background: C.panel, border: `1px solid ${bc}`, borderRadius: 8, padding: "16px 18px" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card(), padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 4 }}>QUARTERLY LOSS TRACKER + MC</div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>Each year = 4 independent quarters (λ, μ, σ). Summed for annual distribution. Q3 dominates — <span style={{ color: C.rose }}>~41% of annual losses.</span></div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {qDone && qSimStats && (
            <div style={{ display: "flex", gap: 16, fontSize: 11, marginRight: 8 }}>
              <span><span style={{ color: C.muted }}>MEAN </span><span style={{ color: C.teal, fontWeight: 700 }}>${qSimStats.mean}B</span></span>
              <span><span style={{ color: C.muted }}>p90 </span><span style={{ color: C.lavender, fontWeight: 700 }}>${qSimStats.p90}B</span></span>
              <span><span style={{ color: C.muted }}>p99 </span><span style={{ color: C.rose, fontWeight: 700 }}>${qSimStats.p99}B</span></span>
            </div>
          )}
          <button
            onClick={runQSim}
            disabled={qRunning}
            style={{ background: qRunning ? C.dim : `${C.teal}18`, border: `1px solid ${qRunning ? C.border : C.teal}`, borderRadius: 6, color: qRunning ? C.muted : C.teal, padding: "7px 20px", fontSize: 12, cursor: qRunning ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}
          >
            {qRunning ? "COMPUTING..." : qDone ? "RE-RUN ↺" : "RUN Q-SIM ▶"}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[1, 2, 3, 4].map((q) => {
          const dp = derivedParams[q];
          const ov = qOverrides[q];
          const col = Q_COLORS[q];
          const hasOv = Object.keys(ov).length > 0;
          return (
            <div key={q} style={{ background: C.panel, border: `1px solid ${hasOv ? col : C.border}`, borderRadius: 8, padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: col, fontWeight: 700 }}>{Q_NAMES[q]}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{dp.n} obs · mean ${dp.mean}B</div>
                </div>
                {hasOv && <button onClick={() => resetQ(q)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, fontSize: 9, padding: "2px 6px", cursor: "pointer" }}>RESET</button>}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 9, color: C.muted }}>λ EVENTS/QTR</span><span style={{ fontSize: 9, color: C.dim }}>data: {dp.lam}</span></div>
                <input type="number" step="1" min="1" max="300" value={ov.lam ?? dp.lam} onChange={(e) => setQParam(q, "lam", e.target.value)} style={{ ...inp3, color: ov.lam != null ? col : C.text, borderColor: ov.lam != null ? `${col}66` : C.border2 }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 9, color: C.muted }}>μ LOG-MEAN</span><span style={{ fontSize: 9, color: C.dim }}>data: {dp.mu}</span></div>
                <input type="number" step="0.05" min="0" max="10" value={ov.mu ?? dp.mu} onChange={(e) => setQParam(q, "mu", e.target.value)} style={{ ...inp3, color: ov.mu != null ? col : C.text, borderColor: ov.mu != null ? `${col}66` : C.border2 }} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 9, color: C.muted }}>σ LOG-SIGMA</span><span style={{ fontSize: 9, color: C.dim }}>data: {dp.sig}</span></div>
                <input type="number" step="0.05" min="0.1" max="3" value={ov.sig ?? dp.sig} onChange={(e) => setQParam(q, "sig", e.target.value)} style={{ ...inp3, color: ov.sig != null ? col : C.text, borderColor: ov.sig != null ? `${col}66` : C.border2 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
        <div style={card()}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 12 }}>HISTORICAL LOSSES BY QUARTER</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={annualQChart} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
              <XAxis dataKey="year" stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} interval={3} />
              <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} formatter={(v, n) => [`$${v.toFixed(1)}B`, n]} />
              <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
              <Bar dataKey="Q1" stackId="s" fill={C.teal} opacity={0.85} name="Q1" />
              <Bar dataKey="Q2" stackId="s" fill={C.sage} opacity={0.85} name="Q2" />
              <Bar dataKey="Q3" stackId="s" fill={C.rose} opacity={0.85} name="Q3" />
              <Bar dataKey="Q4" stackId="s" fill={C.lavender} opacity={0.85} name="Q4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {qDone && qSimStats ? (
            <div style={card()}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>Q-MODEL ANNUAL DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={qHistData} margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
                  <XAxis dataKey="bin" stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} interval={9} tickFormatter={(v) => `$${v}B`} />
                  <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={28} />
                  <Tooltip formatter={(v) => [`${v.toFixed(3)}%`, "Freq"]} contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} />
                  <Bar dataKey="freq" radius={[1, 1, 0, 0]}>
                    {qHistData.map((_, i) => <Cell key={i} fill={i < qHistData.length * 0.65 ? C.teal : i < qHistData.length * 0.88 ? C.lavender : C.rose} fillOpacity={0.78} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: 8 }}>
                <tbody>
                  {[["Mean", qSimStats.mean, "teal"], ["p75", qSimStats.p75, "sage"], ["p90", qSimStats.p90, "lavender"], ["p99", qSimStats.p99, "rose"]].map(([l, v, c]) => (
                    <tr key={l} style={{ borderBottom: `1px solid ${C.dim}` }}>
                      <td style={{ padding: "4px 8px", color: C.muted, fontSize: 10 }}>{l}</td>
                      <td style={{ padding: "4px 8px", color: C[c], textAlign: "right", fontWeight: 600 }}>${v}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...card(), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 11, textAlign: "center", minHeight: 120 }}>Run Q-SIM to see quarterly-composed distribution</div>
          )}
        </div>
      </div>
      <div style={card()}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 12 }}>QUARTERLY LOSS SERIES — EACH QUARTER INDEPENDENTLY</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
            <XAxis dataKey="year" type="number" domain={[yearFrom, yearTo]} stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} />
            <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={(v) => `$${v}B`} />
            <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} formatter={(v, n) => [`$${v.toFixed(1)}B`, n]} />
            <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
            {[1, 2, 3, 4].map((q) => (
              <Line key={q} data={qScatter[q]} dataKey="loss" type="monotone" stroke={Q_COLORS[q]} strokeWidth={1.5} dot={{ r: 2, fill: Q_COLORS[q] }} name={Q_NAMES[q]} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
