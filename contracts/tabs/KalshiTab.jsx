import { useState, useMemo } from "react";
import { C } from "../constants.js";
import { kellyBuyYes, kellySellYes } from "../utils.js";

export default function KalshiTab({ contracts = [], simDone, sim }) {
  const [notional, setNotional] = useState(10000);
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [posSize, setPosSize] = useState(Object.fromEntries((contracts || []).map((c) => [c.strike, 100])));

  const rows = useMemo(() => {
    if (!contracts?.length) return [];
    return contracts.map((c) => {
      const implCapped = Math.min(c.implP, 99.0);
      const yesPrice = implCapped / 100;
      const noPrice = 1 - yesPrice;
      const trueP = c.trueP / 100;
      const valid = implCapped < 99 && c.trueP < 95;
      const buyEdge = trueP - yesPrice;
      const sellEdge = yesPrice - trueP;
      const position = buyEdge > 0 ? "BUY_YES" : "SELL_YES";
      let kelly, ev, collects, maxLoss, upfront;
      if (position === "BUY_YES") {
        kelly = kellyBuyYes(trueP, yesPrice);
        upfront = yesPrice;
        collects = noPrice;
        maxLoss = yesPrice;
        ev = buyEdge;
      } else {
        kelly = kellySellYes(trueP, yesPrice);
        upfront = 0;
        collects = yesPrice;
        maxLoss = noPrice;
        ev = sellEdge;
      }
      const contracts_n = posSize[c.strike] ?? 100;
      const totalUpfront = upfront * contracts_n * notional / 100;
      const totalCollects = collects * contracts_n * notional / 100;
      const totalMaxLoss = maxLoss * contracts_n * notional / 100;
      const totalEV = ev * contracts_n * notional / 100;
      const strength = !valid ? "skip" : ev > 0.15 ? "strong" : ev > 0.05 ? "good" : ev > 0.01 ? "marginal" : "skip";
      return { ...c, yesPrice, noPrice, trueP, position, buyEdge, sellEdge, ev, kelly, totalUpfront, totalCollects, totalMaxLoss, totalEV, valid, strength, contracts_n };
    });
  }, [contracts, posSize, notional]);

  const crossover = useMemo(() => {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].position === "BUY_YES" && rows[i].position === "SELL_YES") return rows[i].strike;
    }
    return null;
  }, [rows]);

  const buyRows = rows.filter((r) => r.position === "BUY_YES" && r.valid);
  const sellRows = rows.filter((r) => r.position === "SELL_YES" && r.valid);
  const totalBookEV = rows.reduce((a, r) => a + (r.valid ? r.totalEV : 0), 0);
  const totalCost = buyRows.reduce((a, r) => a + r.totalUpfront, 0);
  const totalCollect = sellRows.reduce((a, r) => a + r.totalCollects, 0);
  const strengthColor = { strong: C.sage, good: C.teal, marginal: C.lavender, skip: C.dim };
  const inp2 = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 5, color: C.text, padding: "5px 9px", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const posInp = { background: C.dim, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.white, padding: "3px 6px", fontSize: 12, width: 65, textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", outline: "none" };
  const tableHeader = (cols) => (
    <tr style={{ borderBottom: `1px solid ${C.border2}` }}>
      {cols.map((h) => <th key={h} style={{ padding: "6px 10px", color: C.muted, fontWeight: 500, textAlign: "right", fontSize: 9, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>)}
    </tr>
  );

  if (!simDone)
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "40px", textAlign: "center", color: C.muted, fontSize: 12 }}>
        Run simulation on Market tab first to generate Kalshi contract prices
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 12 }}>POSITION LOGIC</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ borderLeft: `3px solid ${C.teal}`, paddingLeft: 12 }}>
            <div style={{ color: C.teal, fontSize: 10, letterSpacing: "0.8px", marginBottom: 4 }}>THE CONTRACT</div>
            <span style={{ color: C.muted }}>"Will NatCat losses exceed <span style={{ color: C.white }}>$X</span> in <span style={{ color: C.white }}>{year}</span>?" YES = breach · NO = safe. Settles at $1.00.</span>
          </div>
          <div style={{ borderLeft: `3px solid ${C.sage}`, paddingLeft: 12 }}>
            <div style={{ color: C.sage, fontSize: 10, letterSpacing: "0.8px", marginBottom: 4 }}>BUY YES — LOW STRIKES</div>
            <span style={{ color: C.muted }}>Market underprices breach. You pay YES price, collect $1 if losses exceed strike.</span>
          </div>
          <div style={{ borderLeft: `3px solid ${C.rose}`, paddingLeft: 12 }}>
            <div style={{ color: C.rose, fontSize: 10, letterSpacing: "0.8px", marginBottom: 4 }}>SELL YES — HIGH STRIKES</div>
            <span style={{ color: C.muted }}>Market overprices fear. You collect YES price, pay $1 if losses exceed strike.</span>
          </div>
        </div>
        {crossover && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: C.dim, borderRadius: 6, fontSize: 11, color: C.muted }}>
            <span style={{ color: C.lavender, fontWeight: 600 }}>CROSSOVER</span> Position flips at <span style={{ color: C.white, fontWeight: 600 }}>${crossover}B</span>
          </div>
        )}
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "13px 18px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "1px" }}>CONTRACT YEAR</span>
          <input type="number" value={year} min={2025} max={2035} style={{ ...inp2, width: 68 }} onChange={(e) => setYear(+e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "1px" }}>SIZE ($/CONTRACT)</span>
          <input type="number" value={notional} min={100} step={100} style={{ ...inp2, width: 88 }} onChange={(e) => setNotional(+e.target.value)} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 20, fontSize: 11 }}>
          <div><span style={{ color: C.muted }}>BOOK EV </span><span style={{ color: totalBookEV > 0 ? C.sage : C.rose, fontWeight: 700 }}>${totalBookEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
          <div><span style={{ color: C.muted }}>BUY COST </span><span style={{ color: C.rose, fontWeight: 700 }}>${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
          <div><span style={{ color: C.muted }}>SELL COLLECTS </span><span style={{ color: C.teal, fontWeight: 700 }}>${totalCollect.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
        </div>
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.sage}44`, borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, color: C.sage, letterSpacing: "1px", marginBottom: 14 }}>↑ BUY YES — LOSSES LIKELY TO BREACH</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>{tableHeader(["CONTRACT", "YES PRICE", "TRUE PROB", "UNDERPRICE", "KELLY", "# CTRS", "YOU PAY", "WIN IF BREACH", "EXP PROFIT", "STRENGTH"])}</thead>
            <tbody>
              {buyRows.length === 0 && <tr><td colSpan={10} style={{ padding: "16px", textAlign: "center", color: C.muted, fontSize: 11 }}>No underpriced strikes</td></tr>}
              {buyRows.map((r) => (
                <tr key={r.strike} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: "9px 10px" }}><div style={{ color: C.white, fontWeight: 600 }}>NatCat &gt; ${r.strike.toLocaleString()}B</div><div style={{ color: C.muted, fontSize: 10 }}>{year} · BUY YES</div></td>
                  <td style={{ padding: "9px 10px", textAlign: "right" }}><span style={{ background: `${C.sage}18`, border: `1px solid ${C.sage}44`, borderRadius: 4, color: C.sage, padding: "2px 8px", fontWeight: 600 }}>{(r.yesPrice * 100).toFixed(1)}¢</span></td>
                  <td style={{ padding: "9px 10px", color: C.teal, textAlign: "right" }}>{(r.trueP * 100).toFixed(2)}%</td>
                  <td style={{ padding: "9px 10px", color: C.sage, textAlign: "right", fontWeight: 600 }}>+{(r.buyEdge * 100).toFixed(1)}¢</td>
                  <td style={{ padding: "9px 10px", color: C.lavender, textAlign: "right" }}>{(r.kelly * 100).toFixed(1)}%</td>
                  <td style={{ padding: "9px 10px", textAlign: "right" }}><input type="number" min={0} step={10} value={posSize[r.strike] ?? 100} onChange={(e) => setPosSize((p) => ({ ...p, [r.strike]: +e.target.value }))} style={posInp} /></td>
                  <td style={{ padding: "9px 10px", color: C.rose, textAlign: "right" }}>−${r.totalUpfront.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", color: C.sage, textAlign: "right", fontWeight: 600 }}>+${r.totalCollects.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", color: r.totalEV > 0 ? C.sage : C.muted, textAlign: "right", fontWeight: 700 }}>${r.totalEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", textAlign: "right", color: strengthColor[r.strength], fontSize: 11, fontWeight: 600 }}>{r.strength === "strong" ? "▲" : r.strength === "good" ? "●" : r.strength === "marginal" ? "→" : "▽"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.rose}44`, borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, color: C.rose, letterSpacing: "1px", marginBottom: 14 }}>↓ SELL YES — FEAR PREMIUM INFLATED</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>{tableHeader(["CONTRACT", "YES PRICE", "TRUE PROB", "OVERPRICE", "KELLY", "# CTRS", "YOU COLLECT", "MAX LOSS", "EXP PROFIT", "STRENGTH"])}</thead>
            <tbody>
              {sellRows.length === 0 && <tr><td colSpan={10} style={{ padding: "16px", textAlign: "center", color: C.muted, fontSize: 11 }}>No overpriced strikes</td></tr>}
              {sellRows.map((r) => (
                <tr key={r.strike} style={{ borderBottom: `1px solid ${C.dim}` }}>
                  <td style={{ padding: "9px 10px" }}><div style={{ color: C.white, fontWeight: 600 }}>NatCat &gt; ${r.strike.toLocaleString()}B</div><div style={{ color: C.muted, fontSize: 10 }}>{year} · SELL YES</div></td>
                  <td style={{ padding: "9px 10px", textAlign: "right" }}><span style={{ background: `${C.rose}18`, border: `1px solid ${C.rose}44`, borderRadius: 4, color: C.rose, padding: "2px 8px", fontWeight: 600 }}>{(r.yesPrice * 100).toFixed(1)}¢</span></td>
                  <td style={{ padding: "9px 10px", color: C.teal, textAlign: "right" }}>{(r.trueP * 100).toFixed(2)}%</td>
                  <td style={{ padding: "9px 10px", color: C.rose, textAlign: "right", fontWeight: 600 }}>+{(r.sellEdge * 100).toFixed(1)}¢</td>
                  <td style={{ padding: "9px 10px", color: C.lavender, textAlign: "right" }}>{(r.kelly * 100).toFixed(1)}%</td>
                  <td style={{ padding: "9px 10px", textAlign: "right" }}><input type="number" min={0} step={10} value={posSize[r.strike] ?? 100} onChange={(e) => setPosSize((p) => ({ ...p, [r.strike]: +e.target.value }))} style={posInp} /></td>
                  <td style={{ padding: "9px 10px", color: C.teal, textAlign: "right", fontWeight: 600 }}>+${r.totalCollects.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", color: C.rose, textAlign: "right" }}>−${r.totalMaxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", color: r.totalEV > 0 ? C.sage : C.muted, textAlign: "right", fontWeight: 700 }}>${r.totalEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: "9px 10px", textAlign: "right", color: strengthColor[r.strength], fontSize: 11, fontWeight: 600 }}>{r.strength === "strong" ? "▲" : r.strength === "good" ? "●" : r.strength === "marginal" ? "→" : "▽"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
