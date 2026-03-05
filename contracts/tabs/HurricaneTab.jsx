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
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { C } from "../constants.js";
import { runHurrSim } from "../utils.js";
import { HURR_ANNUAL, HURR_PARAMS, HURR_STRIKES } from "../data/contractsData.js";

export default function HurricaneTab() {
  const [mu, setMu] = useState(HURR_PARAMS.mu);
  const [sigma, setSigma] = useState(HURR_PARAMS.sigma);
  const [nSimH, setNSimH] = useState(40000);
  const [sim, setSim] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [notional, setNotional] = useState(10000);
  const [posSize, setPosSize] = useState({});
  const [actualYTD, setActualYTD] = useState("");
  const [fearMult, setFearMult] = useState(1.7);
  const [elNino, setElNino] = useState(false);
  const [laNina, setLaNina] = useState(false);

  const climateAdj = elNino ? -0.3 : laNina ? 0.25 : 0;
  const adjMu = +(mu + climateAdj).toFixed(4);

  const runSim = () => {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      let s = runHurrSim(adjMu, sigma, nSimH);
      const ytd = parseFloat(actualYTD) || 0;
      if (ytd > 0) s = s.map((v) => Math.max(v, ytd));
      setSim(s);
      setDone(true);
      setRunning(false);
    }, 60);
  };

  const rows = useMemo(() => {
    if (!sim.length) return [];
    const histValid = HURR_ANNUAL.filter((r) => r.loss_B > 0);
    return HURR_STRIKES.map((strike) => {
      const trueP = sim.filter((v) => v > strike).length / sim.length;
      const implP = Math.min(trueP * fearMult, 0.99);
      const yesPrice = implP;
      const pos = trueP > yesPrice ? "BUY_YES" : "SELL_YES";
      const edge = pos === "BUY_YES" ? trueP - yesPrice : yesPrice - trueP;
      const n = posSize[strike] ?? 50;
      const collects = pos === "SELL_YES" ? yesPrice * n * notional / 100 : (1 - yesPrice) * n * notional / 100;
      const maxLoss = pos === "SELL_YES" ? (1 - yesPrice) * n * notional / 100 : yesPrice * n * notional / 100;
      const ev = edge * n * notional / 100;
      const histRate = histValid.filter((r) => r.loss_B > strike).length / histValid.length * 100;
      const strength = edge > 0.15 ? "strong" : edge > 0.05 ? "good" : edge > 0.01 ? "marginal" : "skip";
      return { strike, trueP: trueP * 100, implP: implP * 100, yesPrice, pos, edge, n, collects, maxLoss, ev, histRate, strength };
    });
  }, [sim, posSize, notional, fearMult]);

  const totalEV = rows.reduce((a, r) => a + r.ev, 0);
  const hist = useMemo(() => {
    if (!sim.length) return [];
    const bins = 50, maxV = 500, w = maxV / bins, counts = Array(bins).fill(0);
    sim.filter((v) => v < maxV).forEach((v) => (counts[Math.min(Math.floor(v / w), bins - 1)]++));
    return counts.map((c, i) => ({ bin: Math.round(i * w), freq: +(c / sim.length * 100).toFixed(3) }));
  }, [sim]);
  const exceed = useMemo(() => {
    if (!sim.length) return [];
    const histValid = HURR_ANNUAL.filter((r) => r.loss_B > 0);
    return Array.from({ length: 50 }, (_, i) => {
      const s = 10 + i * 10;
      const t = sim.filter((v) => v > s).length / sim.length * 100;
      const h = histValid.filter((r) => r.loss_B > s).length / histValid.length * 100;
      return { threshold: s, model: +t.toFixed(2), historical: +h.toFixed(2), implied: +(t * fearMult).toFixed(2) };
    });
  }, [sim, fearMult]);

  const scColor = { strong: C.sage, good: C.teal, marginal: C.lavender, skip: C.dim };
  const inp = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.text, padding: "5px 8px", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const posInp = { background: C.dim, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.white, padding: "3px 5px", fontSize: 11, width: 55, textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const card = (bc = C.border) => ({ background: C.panel, border: `1px solid ${bc}`, borderRadius: 8, padding: "16px 18px" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card(), borderColor: C.rose + "44", padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: C.rose, fontWeight: 700, letterSpacing: "0.5px", marginBottom: 4 }}>Atlantic Hurricane Season — Jun 1 to Nov 30</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
              25 seasons (2000–2024) · Mean <span style={{ color: C.white }}>${HURR_PARAMS.mean}B</span> · Median <span style={{ color: C.white }}>${HURR_PARAMS.median}B</span> · Max <span style={{ color: C.rose }}>${HURR_PARAMS.max}B</span> (2017)
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {done && <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
              <span><span style={{ color: C.muted }}>SIM MEAN </span><span style={{ color: C.teal, fontWeight: 700 }}>${(sim.reduce((a, b) => a + b, 0) / sim.length).toFixed(0)}B</span></span>
              <span><span style={{ color: C.muted }}>BOOK EV </span><span style={{ color: totalEV > 0 ? C.sage : C.rose, fontWeight: 700 }}>${totalEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
            </div>}
            <button onClick={runSim} disabled={running} style={{ background: running ? C.dim : C.rose + "18", border: `1px solid ${running ? C.border : C.rose}`, borderRadius: 6, color: running ? C.muted : C.rose, padding: "7px 20px", fontSize: 12, cursor: running ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>
              {running ? "COMPUTING..." : done ? "RE-RUN ↺" : "RUN SIM ▶"}
            </button>
          </div>
        </div>
      </div>
      <div style={card()}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 12 }}>MODEL PARAMETERS</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div><span style={{ fontSize: 10, color: C.muted }}>MU (μ)</span><input type="number" value={mu} step={0.05} min={2} max={7} onChange={(e) => { setMu(parseFloat(e.target.value)); setDone(false); }} style={{ ...inp, width: 72, marginLeft: 8 }} /></div>
          <div><span style={{ fontSize: 10, color: C.muted }}>SIGMA (σ)</span><input type="number" value={sigma} step={0.05} min={0.3} max={2.5} onChange={(e) => { setSigma(parseFloat(e.target.value)); setDone(false); }} style={{ ...inp, width: 72, marginLeft: 8 }} /></div>
          <div><span style={{ fontSize: 10, color: C.muted }}>FEAR MULT</span><input type="number" value={fearMult} step={0.05} min={1} max={3} onChange={(e) => setFearMult(parseFloat(e.target.value))} style={{ ...inp, width: 72, marginLeft: 8 }} /></div>
          <div><span style={{ fontSize: 10, color: C.muted }}>YTD ACTUAL ($B)</span><input type="number" min={0} step={1} placeholder="known losses" value={actualYTD} onChange={(e) => { setActualYTD(e.target.value); setDone(false); }} style={{ ...inp, width: 100, marginLeft: 8 }} /></div>
          <div><span style={{ fontSize: 10, color: C.muted }}>SIZE ($/CTR)</span><input type="number" min={100} step={100} value={notional} onChange={(e) => setNotional(+e.target.value)} style={{ ...inp, width: 88, marginLeft: 8 }} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ background: elNino ? C.lavender + "18" : C.dim, border: `1px solid ${elNino ? C.lavender : C.border}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer" }} onClick={() => { setElNino((v) => !v); setLaNina(false); setDone(false); }}>
              <span style={{ fontSize: 11, color: elNino ? C.lavender : C.muted, fontWeight: elNino ? 600 : 400 }}>El Niño</span>
            </div>
            <div style={{ background: laNina ? C.rose + "18" : C.dim, border: `1px solid ${laNina ? C.rose : C.border}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer" }} onClick={() => { setLaNina((v) => !v); setElNino(false); setDone(false); }}>
              <span style={{ fontSize: 11, color: laNina ? C.rose : C.muted, fontWeight: laNina ? 600 : 400 }}>La Niña</span>
            </div>
          </div>
        </div>
      </div>
      {done && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={card()}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>HISTORICAL HURRICANE SEASON LOSSES</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={HURR_ANNUAL.filter((r) => r.loss_B > 0)} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.dim} />
                <XAxis dataKey="year" stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} interval={2} />
                <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `$${v}B`} />
                <Tooltip formatter={(v) => [`$${v.toFixed(1)}B`, "Loss"]} contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} />
                <ReferenceLine y={HURR_PARAMS.mean} stroke={C.teal} strokeDasharray="4 3" label={{ value: "Mean", fill: C.teal, fontSize: 9, position: "insideTopRight" }} />
                <Bar dataKey="loss_B" name="Season Loss" radius={[2, 2, 0, 0]}>
                  {HURR_ANNUAL.filter((r) => r.loss_B > 0).map((r, i) => <Cell key={i} fill={r.loss_B > 200 ? C.rose : r.loss_B > 100 ? C.lavender : r.loss_B > 50 ? C.sage : C.teal} opacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={card()}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 8 }}>SIMULATED DISTRIBUTION</div>
            <ResponsiveContainer width="100%" height={95}>
              <BarChart data={hist} margin={{ top: 2, right: 6, left: 0, bottom: 2 }}>
                <XAxis dataKey="bin" stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} interval={9} tickFormatter={(v) => `$${v}B`} />
                <YAxis stroke={C.border2} tick={{ fill: C.muted, fontSize: 9 }} tickFormatter={(v) => `${v}%`} width={28} />
                <Bar dataKey="freq" radius={[1, 1, 0, 0]}>
                  {hist.map((_, i) => <Cell key={i} fill={i < hist.length * 0.6 ? C.teal : i < hist.length * 0.85 ? C.lavender : C.rose} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div style={card()}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 14 }}>HURRICANE SEASON 2026 CONTRACTS</div>
        {!done ? (
          <div style={{ textAlign: "center", padding: "20px", color: C.muted, fontSize: 11 }}>Run simulation to price contracts</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border2}` }}>
              {["STRIKE", "YES¢", "TRUE%", "HIST%", "EDGE", "POS", "# CTRS", "COLLECT", "MAX LOSS", "EV", "STR"].map((h) => <th key={h} style={{ padding: "6px 10px", color: C.muted, fontWeight: 500, textAlign: "right", fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((r) => {
              const posCol = r.pos === "BUY_YES" ? C.sage : C.rose;
              return (
                <tr key={r.strike} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: "8px 10px", color: "#c4956a", textAlign: "right", fontWeight: 700 }}>${r.strike}B</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}><span style={{ background: posCol + "18", border: "1px solid " + posCol + "44", borderRadius: 3, color: posCol, padding: "2px 7px", fontWeight: 600 }}>{(r.yesPrice * 100).toFixed(1)}¢</span></td>
                  <td style={{ padding: "8px 10px", color: C.teal, textAlign: "right" }}>{r.trueP.toFixed(2)}%</td>
                  <td style={{ padding: "8px 10px", color: C.muted, textAlign: "right" }}>{r.histRate.toFixed(1)}%</td>
                  <td style={{ padding: "8px 10px", color: r.edge > 0.05 ? C.sage : C.muted, textAlign: "right", fontWeight: 600 }}>{(r.edge * 100).toFixed(1)}¢</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}><span style={{ color: posCol, fontSize: 11, fontWeight: 600 }}>{r.pos === "BUY_YES" ? "↑ BUY" : "↓ SELL"}</span></td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}><input type="number" min={0} step={10} value={posSize[r.strike] ?? 50} onChange={(e) => setPosSize((p) => ({ ...p, [r.strike]: +e.target.value }))} style={posInp} /></td>
                  <td style={{ padding: "8px 10px", color: C.teal, textAlign: "right" }}>${r.collects.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "8px 10px", color: C.rose, textAlign: "right" }}>${r.maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "8px 10px", color: r.ev > 0 ? C.sage : C.muted, textAlign: "right", fontWeight: 700 }}>${r.ev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: scColor[r.strength], fontSize: 11, fontWeight: 600 }}>{r.strength === "strong" ? "▲" : r.strength === "good" ? "●" : r.strength === "marginal" ? "→" : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
