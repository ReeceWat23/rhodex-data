import { useState, useMemo } from "react";
import { C, Q_NAMES, Q_COLORS, DEFAULT_Q_STRIKES, DEFAULT_YTD_STRIKES, FEAR_Q } from "../constants.js";
import { exceedProb, qKellyBuy, qKellySell, runQSimSingle } from "../utils.js";
import { Q_HIST } from "../data/contractsData.js";

export default function QKalshiTab() {
  const [notional, setNotional] = useState(10000);
  const [contractMode, setContractMode] = useState("both");
  const [simCache, setSimCache] = useState({});
  const [simDone, setSimDone] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [posSize, setPosSize] = useState({});
  const [qov, setQov] = useState({ 1: {}, 2: {}, 3: {}, 4: {} });
  const [ytdActual, setYtdActual] = useState({ 1: null, 2: null, 3: null, 4: null });
  const setQP = (q, k, v) => setQov((o) => { const n = { ...o }; n[q] = { ...n[q], [k]: parseFloat(v) || undefined }; return n; });

  const runAllSims = () => {
    setSimRunning(true);
    setSimDone(false);
    setTimeout(() => {
      const cache = {};
      for (const q of [1, 2, 3, 4]) cache[q] = runQSimSingle(q, qov[q], Q_HIST[q], 30000);
      setSimCache(cache);
      setSimDone(true);
      setSimRunning(false);
    }, 80);
  };

  const buildRows = (sim, strikes, keyPfx) => {
    return strikes.map((strike) => {
      const trueP = exceedProb(sim, strike);
      const implP = Math.min(trueP * FEAR_Q, 0.99);
      const yesPrice = implP;
      const pos = trueP > implP ? "BUY_YES" : "SELL_YES";
      const edge = pos === "BUY_YES" ? trueP - implP : implP - trueP;
      const kelly = pos === "BUY_YES" ? qKellyBuy(trueP, yesPrice) : qKellySell(trueP, yesPrice);
      const n = posSize[keyPfx + "_" + strike] ?? 50;
      const collects = pos === "SELL_YES" ? yesPrice * n * notional / 100 : (1 - yesPrice) * n * notional / 100;
      const maxLoss = pos === "SELL_YES" ? (1 - yesPrice) * n * notional / 100 : yesPrice * n * notional / 100;
      const ev = edge * n * notional / 100;
      const strength = edge > 0.15 ? "strong" : edge > 0.05 ? "good" : edge > 0.01 ? "marginal" : "skip";
      return { strike, trueP, implP, yesPrice, pos, edge, kelly, n, collects, maxLoss, ev, strength };
    });
  };

  const qRows = useMemo(() => {
    if (!simDone) return {};
    const out = {};
    for (const q of [1, 2, 3, 4]) out[q] = buildRows(simCache[q] || [], DEFAULT_Q_STRIKES[q] || [], "q" + q);
    return out;
  }, [simDone, simCache, posSize, notional]);

  const ytdRows = useMemo(() => {
    if (!simDone) return {};
    const nSim = 30000;
    const out = {};
    for (const q of [1, 2, 3, 4]) {
      const combined = Array.from({ length: nSim }, (_, i) => {
        let tot = 0;
        for (let qq = 1; qq <= q; qq++) {
          if (ytdActual[qq] != null) { tot += parseFloat(ytdActual[qq]) || 0; continue; }
          tot += (simCache[qq] || Array(nSim).fill(0))[i % 30000] || 0;
        }
        return tot;
      });
      const known = [1, 2, 3, 4].filter((qq) => qq <= q && ytdActual[qq] != null);
      const knownSum = known.reduce((a, qq) => a + (parseFloat(ytdActual[qq]) || 0), 0);
      out[q] = { rows: buildRows(combined, DEFAULT_YTD_STRIKES[q] || [], "ytd" + q), known, knownSum };
    }
    return out;
  }, [simDone, simCache, posSize, notional, ytdActual]);

  const totalBookEV = useMemo(() => {
    let ev = 0;
    if (contractMode !== "ytd") Object.values(qRows).flat().forEach((r) => (ev += r.ev || 0));
    if (contractMode !== "qspecific") Object.values(ytdRows).forEach((o) => (o.rows || []).forEach((r) => (ev += r.ev || 0)));
    return ev;
  }, [qRows, ytdRows, contractMode]);

  const scColor = { strong: C.sage, good: C.teal, marginal: C.lavender, skip: C.dim };
  const inp4 = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.text, padding: "4px 8px", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const posInp = { background: C.dim, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.white, padding: "3px 5px", fontSize: 11, width: 55, textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const card = (bc = C.border) => ({ background: C.panel, border: `1px solid ${bc}`, borderRadius: 8, padding: "16px 18px" });

  const ContractTable = ({ rows, keyPfx }) => {
    if (!rows?.length) return <div style={{ padding: "12px", color: C.muted, fontSize: 11, textAlign: "center" }}>Run Q-Sim to price contracts</div>;
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr style={{ borderBottom: `1px solid ${C.border2}` }}>
          {["STRIKE", "YES¢", "TRUE%", "EDGE", "KELLY", "POS", "# CTRS", "COLLECT", "MAX LOSS", "EV", "STR"].map((h) => <th key={h} style={{ padding: "5px 8px", color: C.muted, fontWeight: 500, textAlign: "right", fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r) => {
          const posCol = r.pos === "BUY_YES" ? C.sage : C.rose;
          const k = keyPfx + "_" + r.strike;
          return (
            <tr key={r.strike} style={{ borderBottom: `1px solid ${C.dim}` }}>
              <td style={{ padding: "7px 8px", color: "#c4956a", textAlign: "right", fontWeight: 600 }}>${r.strike}B</td>
              <td style={{ padding: "7px 8px", textAlign: "right" }}><span style={{ background: posCol + "18", border: "1px solid " + posCol + "44", borderRadius: 3, color: posCol, padding: "1px 6px", fontWeight: 600 }}>{(r.yesPrice * 100).toFixed(1)}¢</span></td>
              <td style={{ padding: "7px 8px", color: C.teal, textAlign: "right" }}>{(r.trueP * 100).toFixed(2)}%</td>
              <td style={{ padding: "7px 8px", color: r.edge > 0.05 ? C.sage : C.muted, textAlign: "right", fontWeight: 600 }}>{(r.edge * 100).toFixed(1)}¢</td>
              <td style={{ padding: "7px 8px", color: C.lavender, textAlign: "right" }}>{(r.kelly * 100).toFixed(1)}%</td>
              <td style={{ padding: "7px 8px", textAlign: "right" }}><span style={{ color: posCol, fontSize: 10, fontWeight: 600 }}>{r.pos === "BUY_YES" ? "↑ BUY" : "↓ SELL"}</span></td>
              <td style={{ padding: "7px 8px", textAlign: "right" }}><input type="number" min={0} step={10} value={posSize[k] ?? 50} onChange={(e) => setPosSize((p) => ({ ...p, [k]: +e.target.value }))} style={posInp} /></td>
              <td style={{ padding: "7px 8px", color: C.teal, textAlign: "right" }}>${r.collects.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: "7px 8px", color: C.rose, textAlign: "right" }}>${r.maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: "7px 8px", color: r.ev > 0 ? C.sage : C.muted, textAlign: "right", fontWeight: 700 }}>${r.ev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: "7px 8px", textAlign: "right", color: scColor[r.strength], fontSize: 10, fontWeight: 600 }}>{r.strength === "strong" ? "▲" : r.strength === "good" ? "●" : r.strength === "marginal" ? "→" : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card(), padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "1px" }}>CONTRACTS</span>
          {[["qspecific", "Q-SPECIFIC"], ["ytd", "YTD CUMULATIVE"], ["both", "BOTH"]].map(([k, l]) => (
            <button key={k} style={{ background: contractMode === k ? C.teal + "18" : "transparent", border: `1px solid ${contractMode === k ? C.teal : C.border}`, borderRadius: 5, color: contractMode === k ? C.teal : C.muted, padding: "4px 12px", fontSize: 11, cursor: "pointer" }} onClick={() => setContractMode(k)}>{l}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted }}>SIZE ($/CONTRACT)</span>
          <input type="number" value={notional} min={100} step={100} onChange={(e) => setNotional(+e.target.value)} style={{ ...inp4, width: 88 }} />
        </div>
        <button onClick={runAllSims} disabled={simRunning} style={{ background: simRunning ? C.dim : C.teal + "18", border: `1px solid ${simRunning ? C.border : C.teal}`, borderRadius: 6, color: simRunning ? C.muted : C.teal, padding: "7px 20px", fontSize: 12, cursor: simRunning ? "not-allowed" : "pointer", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>
          {simRunning ? "COMPUTING..." : simDone ? "RE-RUN ↺" : "RUN Q-SIM ▶"}
        </button>
        {simDone && <div style={{ marginLeft: "auto", fontSize: 11 }}><span style={{ color: C.muted }}>BOOK EV </span><span style={{ color: totalBookEV > 0 ? C.sage : C.rose, fontWeight: 700 }}>${totalBookEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>}
      </div>
      <div style={{ ...card(), padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>PER-QUARTER MODEL OVERRIDES</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[1, 2, 3, 4].map((q) => {
            const d = Q_HIST[q];
            const col = Q_COLORS[q];
            const ov = qov[q];
            return (
              <div key={q} style={{ border: `1px solid ${Object.keys(ov).length > 0 ? col : C.dim}`, borderRadius: 6, padding: "10px" }}>
                <div style={{ fontSize: 11, color: col, fontWeight: 700, marginBottom: 8 }}>{Q_NAMES[q]}</div>
                {[["mu", "μ log-mean", 1, 9, 0.05], ["sigma", "σ log-sigma", 0.1, 3, 0.05]].map(([k, lbl, mn, mx, st]) => (
                  <div key={k} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted, marginBottom: 2 }}><span>{lbl}</span><span style={{ color: C.dim }}>data:{d[k === "lam" ? "lam" : k === "mu" ? "mu" : "sigma"]}</span></div>
                    <input type="number" step={st} min={mn} max={mx} value={ov[k] ?? d[k === "lam" ? "lam" : k === "mu" ? "mu" : "sigma"]} onChange={(e) => setQP(q, k, e.target.value)} style={{ ...inp4, width: "100%", textAlign: "center", borderColor: ov[k] != null ? col : C.border2, color: ov[k] != null ? col : C.text }} />
                  </div>
                ))}
                {Object.keys(ov).length > 0 && <button onClick={() => setQov((o) => ({ ...o, [q]: {} }))} style={{ marginTop: 4, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 9, padding: "2px 8px", cursor: "pointer", width: "100%" }}>RESET</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ ...card(), padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>2026 ACTUALS — lock in known quarterly losses</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {[1, 2, 3, 4].map((q) => {
            const col = Q_COLORS[q];
            const isKnown = ytdActual[q] != null;
            return (
              <div key={q} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: col, minWidth: 100 }}>{Q_NAMES[q]}</span>
                <input type="number" step="1" min="0" placeholder="actual $B" value={ytdActual[q] ?? ""} onChange={(e) => setYtdActual((a) => ({ ...a, [q]: e.target.value ? parseFloat(e.target.value) : null }))} style={{ ...inp4, width: 90, borderColor: isKnown ? col + "88" : C.border2, color: isKnown ? col : C.text }} />
                {isKnown && <span style={{ fontSize: 10, color: col }}>✓ LOCKED</span>}
              </div>
            );
          })}
        </div>
      </div>
      {(contractMode === "qspecific" || contractMode === "both") && [1, 2, 3, 4].map((q) => (
        <div key={q} style={{ ...card(), borderColor: Q_COLORS[q] + "44", padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: Q_COLORS[q], fontWeight: 700 }}>{Q_NAMES[q]} 2026 — Q-SPECIFIC</span>
            {simDone && <span style={{ fontSize: 10, color: C.muted }}>Hist p50 ${Q_HIST[q].p50}B · p90 ${Q_HIST[q].p90}B</span>}
          </div>
          <ContractTable rows={qRows[q] || []} keyPfx={"q" + q} />
        </div>
      ))}
      {(contractMode === "ytd" || contractMode === "both") && [1, 2, 3, 4].map((q) => {
        const data = ytdRows[q] || { rows: [], known: [], knownSum: 0 };
        return (
          <div key={"ytd" + q} style={{ ...card(), borderColor: Q_COLORS[q] + "33", padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: Q_COLORS[q], fontWeight: 700 }}>YTD THROUGH {Q_NAMES[q].toUpperCase()} 2026</span>
              {data.known.length > 0 && <span style={{ fontSize: 10, color: C.teal }}>({data.known.length} locked · ${data.knownSum.toFixed(0)}B known)</span>}
            </div>
            <ContractTable rows={data.rows || []} keyPfx={"ytd" + q} />
          </div>
        );
      })}
    </div>
  );
}
