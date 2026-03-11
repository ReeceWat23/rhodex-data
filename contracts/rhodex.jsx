import { useState, useMemo, useCallback, useRef } from "react";
import { AreaChart,Area,BarChart,Bar,LineChart,Line,XAxis,YAxis,
  CartesianGrid,Tooltip,Legend,ResponsiveContainer,ReferenceLine,Cell } from "recharts";
import LiveGlobe from "./Globe.jsx";
import { C, SOURCES, DISASTER_TYPES, REGIONS, DEFAULT_STRIKES, FEAR_MULT, TYPE_C, TAB_CONFIG } from "./constants.js";
import { deriveParams, runMC, priceContracts } from "./utils.js";
import SliderInput from "./components/SliderInput.jsx";
import MarketTab from "./tabs/MarketTab.jsx";
import ContractsTab from "./tabs/ContractsTab.jsx";
import CompareTab from "./tabs/CompareTab.jsx";
import LiveEarthTab from "./tabs/LiveEarthTab.jsx";
import QuarterlyTab from "./tabs/QuarterlyTab.jsx";
import KalshiTab from "./tabs/KalshiTab.jsx";
import QKalshiTab from "./tabs/QKalshiTab.jsx";
import HurricaneTab from "./tabs/HurricaneTab.jsx";
import { RAW_EMDAT, RAW_CALIBRATED, OWID_RECORDS, SMART_RECORDS, OWID_ANNUAL, SMART_ANNUAL, COMPARISON } from "./data/rhodexData.js";
/* ── MAIN ── */
export default function Rhodex(){
  const [source,setSource]         = useState("smart");
  const [disType,setDisType]       = useState("All");
  const [region,setRegion]         = useState("All");
  const [chartMode,setChartMode]   = useState("aggregate");
  const [simDone,setSimDone]       = useState(false);
  const [simRunning,setSimRunning] = useState(false);
  const [sim,setSim]               = useState([]);
  const [activeTab,setActiveTab]   = useState("market");
  const [riskMults,setRiskMults]   = useState(Object.fromEntries(DEFAULT_STRIKES.map(s=>[s,2.5])));
  const [globalMult,setGlobalMult] = useState(2.5);
  const [customStrike,setCustomStrike]=useState("");
  const [strikes,setStrikes]       = useState(DEFAULT_STRIKES);
  const [yearFrom,setYearFrom]     = useState(2000);
  const [yearTo,setYearTo]         = useState(2024);

  /* ── MC PARAMETERS ── */
  const [nSim,setNSim]             = useState(40000);
  const [muOverride,setMuOverride] = useState(null);   // null = use data
  const [sigOverride,setSigOverride]= useState(null);
  const [lamOverride,setLamOverride]= useState(null);
  const [mcPanelOpen,setMcPanelOpen]= useState(false);
  const [muManual,setMuManual]     = useState(5.1);
  const [sigManual,setSigManual]   = useState(0.6);
  const [lamManual,setLamManual]   = useState(128);
  const [muLocked,setMuLocked]     = useState(false);
  const [sigLocked,setSigLocked]   = useState(false);
  const [lamLocked,setLamLocked]   = useState(false);

  const isOwidBased=source==="owid"||source==="smart";
  const src=SOURCES[source];
  const annualMap=source==="smart"?SMART_ANNUAL:OWID_ANNUAL;

  /* filtered events */
  const {filteredEvents,annualData,activeTypes,dataParams}=useMemo(()=>{
    let records,byYear={};
    if(isOwidBased){
      const pool=source==="smart"?SMART_RECORDS:OWID_RECORDS;
      records=pool.filter(r=>(disType==="All"||r[1]===disType)&&r[4]>0&&r[0]>=yearFrom&&r[0]<=yearTo);
      const aggYrs=disType==="All"
        ?Object.entries(annualMap).filter(([y])=>+y>=yearFrom&&+y<=yearTo).map(([y,v])=>({year:+y,total:v})).sort((a,b)=>a.year-b.year)
        :null;
      records.forEach(r=>{
        if(!byYear[r[0]])byYear[r[0]]={year:+r[0]};
        byYear[r[0]][r[1]]=(byYear[r[0]][r[1]]||0)+r[4];
        byYear[r[0]].total=(byYear[r[0]].total||0)+r[4];
      });
      const perType=Object.values(byYear).sort((a,b)=>a.year-b.year);
      const annData=chartMode==="aggregate"&&aggYrs?aggYrs:perType;
      // For annual mode derive params from annual totals
      const annVals=aggYrs?aggYrs.map(d=>d.total):records.map(r=>r[4]);
      const dp=deriveParams(annVals);
      return{filteredEvents:records,annualData:annData,activeTypes:[...new Set(records.map(r=>r[1]))],dataParams:dp};
    } else {
      const raw=source==="calibrated"?RAW_CALIBRATED:RAW_EMDAT;
      records=raw.filter(r=>(disType==="All"||r[1]===disType)&&(region==="All"||r[3]===region)&&r[4]>0&&r[0]>=yearFrom&&r[0]<=yearTo);
      records.forEach(r=>{
        if(!byYear[r[0]])byYear[r[0]]={year:r[0]};
        byYear[r[0]][r[1]]=(byYear[r[0]][r[1]]||0)+r[4];
        byYear[r[0]].total=(byYear[r[0]].total||0)+r[4];
      });
      const dp=deriveParams(records.map(r=>r[4]));
      return{filteredEvents:records,annualData:Object.values(byYear).sort((a,b)=>a.year-b.year),activeTypes:[...new Set(records.map(r=>r[1]))],dataParams:dp};
    }
  },[source,disType,region,chartMode,yearFrom,yearTo]);

  const stats=useMemo(()=>{
    const t=annualData.map(d=>d.total).filter(Boolean);
    if(!t.length)return{};
    const mi=t.indexOf(Math.max(...t));
    return{mean:t.reduce((a,b)=>a+b,0)/t.length,max:Math.max(...t),maxYear:annualData[mi]?.year,n:filteredEvents.length};
  },[annualData,filteredEvents]);

  /* sync manual sliders when data changes (if not locked) */
  const prevData=useRef(null);
  useMemo(()=>{
    if(!muLocked) setMuManual(dataParams.mu);
    if(!sigLocked) setSigManual(dataParams.sigma);
    if(!lamLocked) setLamManual(dataParams.lam);
  },[dataParams]);

  /* run sim */
  const runSim=useCallback(()=>{
    setSimRunning(true);setSimDone(false);
    setTimeout(()=>{
      const useAnnual=isOwidBased&&disType==="All";
      const events=useAnnual
        ?Object.entries(annualMap).filter(([y])=>+y>=yearFrom&&+y<=yearTo).map(([,v])=>v)
        :filteredEvents.map(r=>r[4]);
      const res=runMC({
        events, nSim,
        muOverride:muLocked?muManual:null,
        sigmaOverride:sigLocked?sigManual:null,
        lamOverride:lamLocked?lamManual:null,
        useAnnual
      });
      setSim(res);setSimRunning(false);setSimDone(true);
    },50);
  },[filteredEvents,source,disType,annualMap,isOwidBased,yearFrom,yearTo,nSim,muLocked,sigLocked,lamLocked,muManual,sigManual,lamManual]);

  const contracts=useMemo(()=>sim.length?priceContracts(sim,strikes,riskMults,globalMult):[],[sim,strikes,riskMults,globalMult]);

  const exceedance=useMemo(()=>sim.length?Array.from({length:60},(_,i)=>{
    const s=10+i*25,t=sim.filter(v=>v>s).length/sim.length*100;
    return{threshold:s,true:+t.toFixed(3),implied:+(t*FEAR_MULT).toFixed(3)};
  }):[],[sim]);

  const histData=useMemo(()=>{
    if(!sim.length)return[];
    const bins=50,max=1800,w=max/bins,counts=Array(bins).fill(0);
    sim.filter(v=>v<max).forEach(v=>counts[Math.min(Math.floor(v/w),bins-1)]++);
    return counts.map((c,i)=>({bin:Math.round(i*w),freq:+(c/sim.length*100).toFixed(3)}));
  },[sim]);

  const pctTable=useMemo(()=>{
    if(!sim.length)return[];
    const sorted=sim.slice().sort((a,b)=>a-b);
    return[50,75,90,95,99,99.5,99.9].map(p=>{
      const idx=Math.floor(p/100*sorted.length);
      return{pct:p,val:+(sorted[idx]||0).toFixed(1),returnYr:(100/(100-p)).toFixed(1)};
    });
  },[sim]);

  const anyLocked=muLocked||sigLocked||lamLocked;
  const reset=()=>{setSimDone(false);setSim([]);};
  const applyGlobal=()=>setRiskMults(Object.fromEntries(strikes.map(s=>[s,globalMult])));
  const addStrike=()=>{
    const v=parseInt(customStrike);
    if(!isNaN(v)&&v>0&&!strikes.includes(v)){
      setStrikes([...strikes,v].sort((a,b)=>a-b));
      setRiskMults(m=>({...m,[v]:globalMult}));setCustomStrike("");
    }
  };

  /* styles */
  const gs={background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'IBM Plex Mono',monospace",fontSize:13};
  const card=(bc=C.border)=>({background:C.panel,border:`1px solid ${bc}`,borderRadius:8,padding:"16px 18px"});
  const inp={background:C.bg,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,padding:"6px 10px",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",outline:"none",width:"100%"};
  const numInp=(w=80)=>({...inp,width:w,textAlign:"center"});
  const pill=(a,c=C.teal)=>({background:a?`${c}18`:"transparent",border:`1px solid ${a?c:C.border}`,borderRadius:5,color:a?c:C.muted,padding:"5px 14px",fontSize:11,cursor:"pointer",letterSpacing:"0.5px",transition:"all .15s",fontFamily:"'IBM Plex Mono',monospace"});
  const tabBtn=(a)=>({background:"transparent",border:"none",borderBottom:`2px solid ${a?C.teal:"transparent"}`,color:a?C.white:C.muted,padding:"10px 18px",fontSize:12,cursor:"pointer",letterSpacing:"0.5px",fontFamily:"'IBM Plex Mono',monospace",transition:"all .15s"});
  const lockBtn=(locked,c)=>({background:locked?`${c}22`:"transparent",border:`1px solid ${locked?c:C.border}`,borderRadius:4,color:locked?c:C.muted,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.5px"});
  const statBox=(val,lbl,col=C.teal)=>(
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",minWidth:100}}>
      <div style={{fontSize:9,color:C.muted,letterSpacing:"1px",marginBottom:4}}>{lbl}</div>
      <div style={{fontSize:18,fontWeight:700,color:col,letterSpacing:"-0.5px"}}>{val}</div>
    </div>
  );

  return(
    <div style={gs}>
      {/* TOPBAR */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <span style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:C.white,letterSpacing:"-0.5px"}}>Rhodex</span>
          <div style={{width:1,height:24,background:C.border}}/>
          {TAB_CONFIG.map(([k,l])=>(
            <button key={k} style={tabBtn(activeTab===k)} onClick={()=>setActiveTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:20,fontSize:11,alignItems:"center"}}>
          {stats.mean&&<><span style={{color:C.muted}}>AVG </span><span style={{color:C.teal,fontWeight:600}}>${stats.mean.toFixed(0)}B</span></>}
          {stats.max&&<><span style={{color:C.muted,marginLeft:12}}>PEAK </span><span style={{color:C.rose,fontWeight:600}}>${stats.max.toFixed(0)}B</span><span style={{color:C.muted}}> ({stats.maxYear})</span></>}
          <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:simDone?C.sage:C.muted,boxShadow:simDone?`0 0 8px ${C.sage}`:"none"}}/>
            <span style={{color:simDone?C.sage:C.muted}}>{simDone?`SIM LIVE · ${nSim.toLocaleString()} YRS`:"SIM IDLE"}</span>
          </div>
        </div>
      </div>

      <div style={{padding:"18px 24px"}}>

        {/* CONTROL STRIP */}
        <div style={{...card(),marginBottom:14}}>
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:10,letterSpacing:"1px",marginRight:2}}>SOURCE</span>
              {Object.entries(SOURCES).map(([k,v])=>(
                <button key={k} style={pill(source===k,v.color)} onClick={()=>{setSource(k);reset();}}>{v.label}</button>
              ))}
            </div>
            <div style={{width:1,height:24,background:C.border}}/>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:10}}>TYPE</span>
              <select style={{...inp,width:150}} value={disType} onChange={e=>{setDisType(e.target.value);reset();}}>
                {DISASTER_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:10}}>REGION</span>
              <select style={{...inp,width:120,opacity:isOwidBased?0.35:1}} value={region}
                onChange={e=>{setRegion(e.target.value);reset();}} disabled={isOwidBased}>
                {REGIONS.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:C.muted,fontSize:10}}>YEARS</span>
              <input type="number" min="1980" max="2024" value={yearFrom} style={numInp(62)} onChange={e=>{setYearFrom(+e.target.value);reset();}}/>
              <span style={{color:C.muted}}>—</span>
              <input type="number" min="1980" max="2024" value={yearTo}   style={numInp(62)} onChange={e=>{setYearTo(+e.target.value);reset();}}/>
            </div>
            <div style={{width:1,height:24,background:C.border}}/>
            <button onClick={runSim} disabled={simRunning} style={{
              background:simRunning?C.dim:`${C.teal}18`,border:`1px solid ${simRunning?C.border:C.teal}`,
              borderRadius:6,color:simRunning?C.muted:C.teal,padding:"7px 20px",fontSize:12,
              cursor:simRunning?"not-allowed":"pointer",letterSpacing:"0.5px",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>
              {simRunning?"COMPUTING...":simDone?"RE-RUN ↺":"RUN SIM ▶"}
            </button>
          </div>
        </div>

        {/* ── MC PARAMETER PANEL ── */}
        <div style={{...card(anyLocked?C.teal:C.border),marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}
            onClick={()=>setMcPanelOpen(v=>!v)}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>MONTE CARLO PARAMETERS</span>
              {anyLocked&&<span style={{fontSize:10,color:C.teal,border:`1px solid ${C.teal}33`,borderRadius:4,padding:"1px 8px"}}>OVERRIDES ACTIVE</span>}
              <span style={{fontSize:10,color:C.muted}}>N={nSim.toLocaleString()} · μ={muLocked?muManual.toFixed(3):`data(${dataParams.mu})`} · σ={sigLocked?sigManual.toFixed(3):`data(${dataParams.sigma})`} · λ={lamLocked?lamManual:dataParams.lam}</span>
            </div>
            <span style={{color:C.muted,fontSize:12}}>{mcPanelOpen?"▲":"▼"}</span>
          </div>

          {mcPanelOpen&&(
            <div style={{marginTop:16,borderTop:`1px solid ${C.dim}`,paddingTop:16}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:24}}>

                {/* N simulations */}
                <div>
                  <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>SIMULATIONS (N)</div>
                  <SliderInput label="YEARS SIMULATED" value={nSim} onChange={v=>{setNSim(Math.round(v));reset();}}
                    min={5000} max={100000} step={5000} color={C.teal}
                    format={v=>`${(v/1000).toFixed(0)}K`}
                    hint={`${nSim.toLocaleString()} simulated years. More = smoother tail but slower.`}/>
                  <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                    {[10000,40000,100000].map(n=>(
                      <button key={n} style={{...pill(nSim===n,C.teal),padding:"3px 10px",fontSize:10}}
                        onClick={()=>{setNSim(n);reset();}}>{n/1000}K</button>
                    ))}
                  </div>
                </div>

                {/* Mu */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>LOG-MEAN (μ)</span>
                    <button style={lockBtn(muLocked,C.lavender)} onClick={()=>{setMuLocked(v=>!v);reset();}}>
                      {muLocked?"LOCKED ●":"LOCK ○"}
                    </button>
                  </div>
                  <SliderInput label="μ VALUE" value={muManual} onChange={v=>{setMuManual(v);if(muLocked)reset();}}
                    min={2} max={9} step={0.05} color={muLocked?C.lavender:C.muted}
                    format={v=>v.toFixed(3)} dataVal={dataParams.mu}
                    hint={`e^μ = $${Math.exp(muManual).toFixed(0)}B median event. ${muLocked?"":"Lock to override data."}`}/>
                  {!muLocked&&<div style={{fontSize:10,color:C.dim,marginTop:6}}>Using data value: <span style={{color:C.muted}}>{dataParams.mu}</span></div>}
                </div>

                {/* Sigma */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>LOG-SIGMA (σ)</span>
                    <button style={lockBtn(sigLocked,C.rose)} onClick={()=>{setSigLocked(v=>!v);reset();}}>
                      {sigLocked?"LOCKED ●":"LOCK ○"}
                    </button>
                  </div>
                  <SliderInput label="σ VALUE" value={sigManual} onChange={v=>{setSigManual(v);if(sigLocked)reset();}}
                    min={0.1} max={3} step={0.05} color={sigLocked?C.rose:C.muted}
                    format={v=>v.toFixed(3)} dataVal={dataParams.sigma}
                    hint={`Controls tail fatness. Higher σ = fatter tail. ${sigLocked?"":"Lock to override."}`}/>
                  {!sigLocked&&<div style={{fontSize:10,color:C.dim,marginTop:6}}>Using data value: <span style={{color:C.muted}}>{dataParams.sigma}</span></div>}
                </div>

                {/* Lambda */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>EVENTS/YR (λ)</span>
                    <button style={lockBtn(lamLocked,C.green)} onClick={()=>{setLamLocked(v=>!v);reset();}}>
                      {lamLocked?"LOCKED ●":"LOCK ○"}
                    </button>
                  </div>
                  <SliderInput label="λ VALUE" value={lamManual} onChange={v=>{setLamManual(Math.round(v));if(lamLocked)reset();}}
                    min={1} max={300} step={1} color={lamLocked?C.green:C.muted}
                    format={v=>`${v}`} dataVal={dataParams.lam}
                    hint={`Avg events per simulated year. ${lamLocked?"":"Lock to override data."}`}/>
                  {!lamLocked&&<div style={{fontSize:10,color:C.dim,marginTop:6}}>Using data value: <span style={{color:C.muted}}>{dataParams.lam}</span></div>}
                </div>
              </div>

              {anyLocked&&(
                <div style={{marginTop:16,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:C.muted}}>PRESETS:</span>
                  {[
                    {label:"Data Default",action:()=>{setMuLocked(false);setSigLocked(false);setLamLocked(false);reset();}},
                    {label:"Climate +20%",action:()=>{setMuManual(+(dataParams.mu+0.18).toFixed(3));setMuLocked(true);reset();}},
                    {label:"Fat Tail",action:()=>{setSigManual(Math.min(dataParams.sigma*1.5,3).toFixed(3)*1);setSigLocked(true);reset();}},
                    {label:"Low Freq",action:()=>{setLamManual(Math.max(1,Math.round(dataParams.lam*0.6)));setLamLocked(true);reset();}},
                  ].map(p=>(
                    <button key={p.label} style={{...pill(false,C.sage),padding:"3px 10px",fontSize:10}}
                      onClick={p.action}>{p.label}</button>
                  ))}
                  <button style={{...pill(false,C.rose),padding:"3px 10px",fontSize:10,marginLeft:"auto"}}
                    onClick={()=>{setMuLocked(false);setSigLocked(false);setLamLocked(false);reset();}}>
                    RESET ALL OVERRIDES
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STATS */}
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          {statBox(stats.n?.toLocaleString()??"—","DATA PTS",C.teal)}
          {statBox(stats.mean?`$${stats.mean.toFixed(0)}B`:"—","MEAN ANNUAL",C.sage)}
          {statBox(stats.max?`$${stats.max.toFixed(0)}B`:"—","PEAK",C.rose)}
          {statBox(`${yearFrom}–${yearTo}`,"WINDOW","#c4956a")}
          {statBox(`${(nSim/1000).toFixed(0)}K`,"SIM YEARS",C.teal)}
          {simDone&&statBox(`$${(sim.reduce((a,b)=>a+b,0)/sim.length).toFixed(0)}B`,"SIM MEAN",C.lavender)}
          {simDone&&statBox(`$${Math.round(sim.slice().sort((a,b)=>a-b)[Math.floor(sim.length*0.99)]).toLocaleString()}B`,"SIM 99th",C.green)}
        </div>

        {activeTab==="market"&&(
          <MarketTab card={card} pill={pill} src={src} annualData={annualData} chartMode={chartMode} setChartMode={setChartMode} activeTypes={activeTypes} simDone={simDone} nSim={nSim} histData={histData} exceedance={exceedance} pctTable={pctTable} TYPE_C={TYPE_C} disType={disType} />
        )}
        {activeTab==="quarterly"&&(<QuarterlyTab yearFrom={yearFrom} yearTo={yearTo} nSim={nSim} />)}
        {activeTab==="kalshi"&&(<KalshiTab contracts={contracts} simDone={simDone} sim={sim} />)}
        {activeTab==="qkalshi"&&(<QKalshiTab />)}
        {activeTab==="hurricane"&&(<HurricaneTab />)}
        {activeTab==="contracts"&&(
          <ContractsTab card={card} pill={pill} numInp={numInp} simDone={simDone} contracts={contracts} riskMults={riskMults} setRiskMults={setRiskMults} globalMult={globalMult} setGlobalMult={setGlobalMult} setStrikes={setStrikes} applyGlobal={applyGlobal} customStrike={customStrike} setCustomStrike={setCustomStrike} addStrike={addStrike} />
        )}
        {activeTab==="compare"&&(<CompareTab comparison={COMPARISON} card={card} />)}
        {activeTab==="live"&&(<LiveEarthTab card={card} />)}
      </div>

      <div style={{padding:"10px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:10,color:C.dim}}>
        <span>Rhodex · EM-DAT © UCLouvain · OWID © Our World in Data · Gallagher RE · Swiss Re sigma</span>
        <span>COMPOUND POISSON · FEAR MULT {FEAR_MULT}×</span>
      </div>
    </div>
  );
}