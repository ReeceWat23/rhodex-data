const C={bg:"#0a0c0d",panel:"#111416",border:"#1e2325",border2:"#252a2c",
  teal:"#258ea6",sage:"#549f93",green:"#9faf90",rose:"#e2b1b1",
  lavender:"#e2c2ff",text:"#c8d0d4",muted:"#5a6468",dim:"#2e3538",white:"#edf1f3"};

const SOURCES={
  smart:     {label:"Smart Adj",   color:C.teal,    note:"OWID + period-aware corrections"},
  owid:      {label:"OWID Raw",    color:C.sage,    note:"Our World in Data 1980–2024"},
  calibrated:{label:"Industry Cal",color:C.lavender,note:"Gallagher RE & Swiss Re multipliers"},
  emdat:     {label:"Raw EM-DAT",  color:C.rose,    note:"EM-DAT CPI-adjusted, 9,781 events"},
};
const DISASTER_TYPES=["All","Flood","Extreme weather","Earthquake","Drought","Wildfire","Extreme temperature","Wet mass movement","Volcanic activity"];
const REGIONS=["All","Africa","Americas","Asia","Europe","Oceania"];
const DEFAULT_STRIKES=[100,120,200,220,250,280,300,320,350,400,450,500,600,800,1000,1500,2000];
const FEAR_MULT=1.7;
const TYPE_C={"Flood":C.teal,"Extreme weather":C.sage,"Earthquake":C.rose,"Drought":C.lavender,
  "Wildfire":"#c4956a","Extreme temperature":C.green,"Wet mass movement":"#7ba5b0","Volcanic activity":"#b09090"};

/* ── DERIVE DATA PARAMS from a series ── */
function deriveParams(values){
  if(!values.length) return {mu:5.1,sigma:0.6,lam:128};
  const lv=values.map(v=>Math.log(Math.max(v,0.001)));
  const mu=lv.reduce((a,b)=>a+b,0)/lv.length;
  const sigma=Math.sqrt(lv.map(v=>(v-mu)**2).reduce((a,b)=>a+b,0)/lv.length);
  return{mu:+mu.toFixed(3),sigma:+sigma.toFixed(3),lam:values.length};
}

/* ── MONTE CARLO — fully parameterised ── */
function runMC({events, nSim, muOverride, sigmaOverride, lamOverride, useAnnual}){
  if(!events.length) return [];
  const lv=events.map(v=>Math.log(Math.max(v,0.001)));
  const dataMu=lv.reduce((a,b)=>a+b,0)/lv.length;
  const dataSig=Math.sqrt(lv.map(v=>(v-dataMu)**2).reduce((a,b)=>a+b,0)/lv.length);
  const mu    = muOverride    ?? dataMu;
  const sigma = sigmaOverride ?? dataSig;
  const lam   = lamOverride   ?? (useAnnual ? 1 : events.length/25);

  if(useAnnual){
    // Annual series: single lognormal draw per year
    return Array.from({length:nSim},()=>{
      const u=Math.random(),v=Math.random();
      return Math.exp(mu+sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v));
    });
  } else {
    // Compound Poisson
    return Array.from({length:nSim},()=>{
      const L=Math.exp(-lam);let k=0,p=1;
      do{k++;p*=Math.random();}while(p>L);
      let tot=0;
      for(let j=0;j<Math.max(k-1,1);j++){
        const u=Math.random(),v=Math.random();
        tot+=Math.exp(mu+sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v));
      }
      return tot;
    });
  }
}

function priceContracts(sim,strikes,riskMults,globalMult){
  return strikes.map(s=>{
    const mult=riskMults[s]??globalMult;
    const trueP=sim.filter(v=>v>s).length/sim.length*100;
    const implP=trueP*FEAR_MULT;
    return{strike:s,trueP,implP,pure:trueP,risk:Math.min(trueP*mult,99),gap:implP-trueP,mult,
      edge:implP-trueP>5?"Strong":implP-trueP>1?"Moderate":"Thin"};
  });
}

const ChartTT=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return <div style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:6,padding:"10px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>
    <div style={{color:C.muted,marginBottom:5}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{marginBottom:2}}>
      <span style={{color:C.muted}}>{p.name}: </span>
      <span style={{color:p.color||C.white,fontWeight:600}}>${typeof p.value==="number"?p.value.toFixed(1):p.value}B</span>
    </div>)}
  </div>;
};

/* ── SLIDER CONTROL COMPONENT ── */
function SliderInput({label:lbl, value, onChange, min, max, step, color=C.teal, format, hint, dataVal}){
  const pct=((value-min)/(max-min)*100).toFixed(1);
  const fmt = format ? format(value) : value;
  const dataFmt = dataVal !== undefined ? (format?format(dataVal):dataVal) : null;
  return(
    <div style={{marginBottom:4}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <span style={{fontSize:10,color:C.muted,letterSpacing:"0.8px"}}>{lbl}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {dataFmt!=null&&(
            <span style={{fontSize:10,color:C.dim,cursor:"pointer"}} title="Click to reset to data value"
              onClick={()=>onChange(dataVal)}>
              DATA: <span style={{color:C.muted}}>{dataFmt}</span>
            </span>
          )}
          <input type="number" value={value} step={step} min={min} max={max}
            onChange={e=>{const v=parseFloat(e.target.value); if(!isNaN(v)) onChange(Math.min(max,Math.max(min,v)));}}
            style={{background:C.dim,border:`1px solid ${color}44`,borderRadius:4,color,padding:"2px 6px",
              fontSize:12,width:72,textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",outline:"none"}}/>
        </div>
      </div>
      <div style={{position:"relative",height:4,background:C.dim,borderRadius:2}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,background:color,borderRadius:2,transition:"width .1s"}}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>onChange(parseFloat(e.target.value))}
          style={{position:"absolute",top:-6,left:0,width:"100%",opacity:0,cursor:"pointer",height:16}}/>
      </div>
      {hint&&<div style={{fontSize:10,color:C.dim,marginTop:4,lineHeight:1.4}}>{hint}</div>}
    </div>
  );
}



/* ── QUARTERLY TRACKER ───────────────────────────────────────────────────── */
function runQMC(qParams, userOverrides, nSim=40000){
  // Simulate annual loss by summing 4 independent quarterly sims
  // Each quarter has its own lambda, mu, sigma from historical data
  const results = Array.from({length:nSim},()=>{
    let annual = 0;
    for(const q of [1,2,3,4]){
      const qs  = qParams[q];
      const lam = userOverrides[q]?.lam ?? qs.lam;
      const mu  = userOverrides[q]?.mu  ?? qs.mu;
      const sig = userOverrides[q]?.sig ?? qs.sig;
      // Compound Poisson for this quarter
      const L=Math.exp(-lam);let k=0,p=1;
      do{k++;p*=Math.random();}while(p>L);
      for(let j=0;j<Math.max(k-1,1);j++){
        const u=Math.random(),v=Math.random();
        annual+=Math.exp(mu+sig*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v));
      }
    }
    return annual;
  });
  return results;
}

function QuarterlyTracker({ source, yearFrom, yearTo, nSim,
  muLocked, muManual, sigLocked, sigManual, lamLocked, lamManual }){

  const qNames = {1:"Q1 Jan–Mar",2:"Q2 Apr–Jun",3:"Q3 Jul–Sep",4:"Q4 Oct–Dec"};
  const qColors= {1:C.teal,2:C.sage,3:C.rose,4:C.lavender};

  // Filter data to selected year range
  const filteredQ = useMemo(()=>
    QUARTERLY_DATA.filter(r=>r.year>=yearFrom&&r.year<=yearTo)
  ,[yearFrom,yearTo]);

  // Build annual-quarter pivot for chart
  const annualQChart = useMemo(()=>{
    const byYear = {};
    filteredQ.forEach(r=>{
      if(!byYear[r.year]) byYear[r.year]={year:r.year,Q1:0,Q2:0,Q3:0,Q4:0,total:0};
      byYear[r.year][`Q${r.quarter}`] = r.loss_B;
      byYear[r.year].total += r.loss_B;
    });
    return Object.values(byYear).sort((a,b)=>a.year-b.year);
  },[filteredQ]);

  // Derived per-quarter params from filtered window
  const derivedParams = useMemo(()=>{
    const out = {};
    for(const q of [1,2,3,4]){
      const vals = filteredQ.filter(r=>r.quarter===q).map(r=>r.loss_B).filter(v=>v>0.1);
      if(!vals.length){ out[q]={mu:3.5,sig:0.8,lam:90,mean:0,std:0,n:0}; continue; }
      const lv  = vals.map(v=>Math.log(v));
      const mu  = lv.reduce((a,b)=>a+b,0)/lv.length;
      const sig = Math.sqrt(lv.map(v=>(v-mu)**2).reduce((a,b)=>a+b,0)/lv.length);
      const evts= filteredQ.filter(r=>r.quarter===q).map(r=>r.events);
      const lam = evts.reduce((a,b)=>a+b,0)/evts.length;
      out[q]={mu:+mu.toFixed(3),sig:+sig.toFixed(3),lam:+lam.toFixed(1),
        mean:+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1),
        std:+(Math.sqrt(vals.map(v=>(v-vals.reduce((a,b)=>a+b,0)/vals.length)**2).reduce((a,b)=>a+b,0)/vals.length)).toFixed(1),
        n:vals.length};
    }
    return out;
  },[filteredQ]);

  // Per-quarter user overrides
  const [qOverrides, setQOverrides] = useState({1:{},2:{},3:{},4:{}});
  const setQParam = (q,param,val)=>setQOverrides(o=>({...o,[q]:{...o[q],[param]:parseFloat(val)||undefined}}));
  const resetQ    = (q)=>setQOverrides(o=>({...o,[q]:{}}));

  // Simulation
  const [qSim,    setQSim]    = useState([]);
  const [annSim,  setAnnSim]  = useState([]);
  const [qRunning,setQRunning]= useState(false);
  const [qDone,   setQDone]   = useState(false);
  const [qSimMode,setQSimMode]= useState("quarterly"); // quarterly | annual_compare

  const runQSim = ()=>{
    setQRunning(true); setQDone(false);
    setTimeout(()=>{
      const qp = {};
      for(const q of [1,2,3,4]) qp[q]={...derivedParams[q],...qOverrides[q]};
      const res = runQMC(qp, {}, nSim);
      setQSim(res);
      setQDone(true); setQRunning(false);
    },60);
  };

  // Quarterly sim percentiles
  const qSimStats = useMemo(()=>{
    if(!qSim.length) return null;
    const s = qSim.slice().sort((a,b)=>a-b);
    const pct = p=>+(s[Math.floor(p/100*s.length)]||0).toFixed(1);
    return{mean:+(qSim.reduce((a,b)=>a+b,0)/qSim.length).toFixed(1),
      p50:pct(50),p75:pct(75),p90:pct(90),p95:pct(95),p99:pct(99)};
  },[qSim]);

  // Distribution histogram
  const qHistData = useMemo(()=>{
    if(!qSim.length) return [];
    const bins=50,max=1500,w=max/bins,counts=Array(bins).fill(0);
    qSim.filter(v=>v<max).forEach(v=>counts[Math.min(Math.floor(v/w),bins-1)]++);
    return counts.map((c,i)=>({bin:Math.round(i*w),freq:+(c/qSim.length*100).toFixed(3)}));
  },[qSim]);

  // Historical quarterly scatter (each Q as data point over years)
  const qScatter = useMemo(()=>{
    const out={};
    for(const q of [1,2,3,4]){
      out[q]=filteredQ.filter(r=>r.quarter===q).map(r=>({year:r.year,loss:r.loss_B,events:r.events}));
    }
    return out;
  },[filteredQ]);

  const inp3={background:C.bg,border:`1px solid ${C.border2}`,borderRadius:4,color:C.text,
    padding:"4px 7px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",width:"100%",textAlign:"center"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* HEADER + RUN */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:4}}>QUARTERLY LOSS TRACKER + MC</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
            Each year modelled as 4 independent quarters with separate λ, μ, σ. Summed for annual distribution.<br/>
            Q3 (hurricane season) dominates — <span style={{color:C.rose}}>~41% of annual losses historically.</span>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {qDone&&qSimStats&&(
            <div style={{display:"flex",gap:16,fontSize:11,marginRight:8}}>
              <span><span style={{color:C.muted}}>MEAN </span><span style={{color:C.teal,fontWeight:700}}>${qSimStats.mean}B</span></span>
              <span><span style={{color:C.muted}}>p90 </span><span style={{color:C.lavender,fontWeight:700}}>${qSimStats.p90}B</span></span>
              <span><span style={{color:C.muted}}>p99 </span><span style={{color:C.rose,fontWeight:700}}>${qSimStats.p99}B</span></span>
            </div>
          )}
          <button onClick={runQSim} disabled={qRunning} style={{
            background:qRunning?C.dim:`${C.teal}18`,border:`1px solid ${qRunning?C.border:C.teal}`,
            borderRadius:6,color:qRunning?C.muted:C.teal,padding:"7px 20px",fontSize:12,
            cursor:qRunning?"not-allowed":"pointer",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>
            {qRunning?"COMPUTING...":qDone?"RE-RUN ↺":"RUN Q-SIM ▶"}
          </button>
        </div>
      </div>

      {/* PER-QUARTER PARAMETER CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[1,2,3,4].map(q=>{
          const dp  = derivedParams[q];
          const ov  = qOverrides[q];
          const col = qColors[q];
          const hasOv = Object.keys(ov).length>0;
          return(
            <div key={q} style={{background:C.panel,border:`1px solid ${hasOv?col:C.border}`,borderRadius:8,padding:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:col,fontWeight:700}}>{qNames[q]}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1}}>
                    {dp.n} obs · mean ${dp.mean}B
                  </div>
                </div>
                {hasOv&&<button onClick={()=>resetQ(q)}
                  style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,
                    color:C.muted,fontSize:9,padding:"2px 6px",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace"}}>
                  RESET
                </button>}
              </div>

              {/* Lambda */}
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:C.muted,letterSpacing:"0.8px"}}>λ EVENTS/QTR</span>
                  <span style={{fontSize:9,color:C.dim}}>data: {dp.lam}</span>
                </div>
                <input type="number" step="1" min="1" max="300"
                  value={ov.lam??dp.lam}
                  onChange={e=>setQParam(q,'lam',e.target.value)}
                  style={{...inp3,color:ov.lam!=null?col:C.text,borderColor:ov.lam!=null?`${col}66`:C.border2}}/>
                {/* Mini bar */}
                <div style={{marginTop:4,height:3,background:C.dim,borderRadius:2}}>
                  <div style={{height:"100%",width:`${Math.min((ov.lam??dp.lam)/200*100,100)}%`,background:col,borderRadius:2}}/>
                </div>
              </div>

              {/* Mu */}
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:C.muted,letterSpacing:"0.8px"}}>μ LOG-MEAN</span>
                  <span style={{fontSize:9,color:C.dim}}>data: {dp.mu}</span>
                </div>
                <input type="number" step="0.05" min="0" max="10"
                  value={ov.mu??dp.mu}
                  onChange={e=>setQParam(q,'mu',e.target.value)}
                  style={{...inp3,color:ov.mu!=null?col:C.text,borderColor:ov.mu!=null?`${col}66`:C.border2}}/>
                <div style={{marginTop:4,fontSize:9,color:C.dim}}>
                  e^μ = ${Math.exp(ov.mu??dp.mu).toFixed(0)}B median
                </div>
              </div>

              {/* Sigma */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:9,color:C.muted,letterSpacing:"0.8px"}}>σ LOG-SIGMA</span>
                  <span style={{fontSize:9,color:C.dim}}>data: {dp.sig}</span>
                </div>
                <input type="number" step="0.05" min="0.1" max="3"
                  value={ov.sig??dp.sig}
                  onChange={e=>setQParam(q,'sig',e.target.value)}
                  style={{...inp3,color:ov.sig!=null?col:C.text,borderColor:ov.sig!=null?`${col}66`:C.border2}}/>
                <div style={{marginTop:4,height:3,background:C.dim,borderRadius:2}}>
                  <div style={{height:"100%",width:`${Math.min((ov.sig??dp.sig)/3*100,100)}%`,background:col,borderRadius:2,opacity:0.7}}/>
                </div>
              </div>

              {/* Historical quick stats */}
              <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${C.dim}`,
                display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {[["AVG EVENTS",dp.lam],["AVG LOSS",`$${dp.mean}B`],
                  ["STD",`$${dp.std}B`],["OBS",dp.n]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:8,color:C.dim,letterSpacing:"0.5px"}}>{l}</div>
                    <div style={{fontSize:11,color:col}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* HISTORICAL STACKED BAR + SIMULATION RESULTS */}
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:14}}>

        {/* Historical quarterly stacked */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 18px"}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>HISTORICAL LOSSES BY QUARTER</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={annualQChart} margin={{top:5,right:8,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
              <XAxis dataKey="year" stroke={C.border2} tick={{fill:C.muted,fontSize:10}} interval={3}/>
              <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
              <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}
                formatter={(v,n)=>[`$${v.toFixed(1)}B`,n]}/>
              <Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
              <Bar dataKey="Q1" stackId="s" fill={C.teal}     opacity={0.85} name="Q1"/>
              <Bar dataKey="Q2" stackId="s" fill={C.sage}     opacity={0.85} name="Q2"/>
              <Bar dataKey="Q3" stackId="s" fill={C.rose}     opacity={0.85} name="Q3"/>
              <Bar dataKey="Q4" stackId="s" fill={C.lavender} opacity={0.85} name="Q4"/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quarterly percentiles */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Per-quarter historical percentile bars */}
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>QUARTERLY LOSS PROFILE (HISTORICAL)</div>
            {[1,2,3,4].map(q=>{
              const vals = filteredQ.filter(r=>r.quarter===q).map(r=>r.loss_B).sort((a,b)=>a-b);
              const p50  = vals[Math.floor(vals.length*0.5)]||0;
              const p90  = vals[Math.floor(vals.length*0.9)]||0;
              const maxV = Math.max(...[1,2,3,4].flatMap(qq=>filteredQ.filter(r=>r.quarter===qq).map(r=>r.loss_B)));
              return(
                <div key={q} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:10}}>
                    <span style={{color:qColors[q]}}>{qNames[q]}</span>
                    <span style={{color:C.muted}}>p50 ${p50.toFixed(0)}B · p90 ${p90.toFixed(0)}B</span>
                  </div>
                  <div style={{position:"relative",height:10,background:C.dim,borderRadius:3}}>
                    <div style={{position:"absolute",left:0,height:"100%",
                      width:`${p90/maxV*100}%`,background:`${qColors[q]}44`,borderRadius:3}}/>
                    <div style={{position:"absolute",left:0,height:"100%",
                      width:`${p50/maxV*100}%`,background:qColors[q],borderRadius:3}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sim results */}
          {qDone&&qSimStats?(
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>Q-MODEL ANNUAL DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={qHistData} margin={{top:2,right:6,left:0,bottom:2}}>
                  <XAxis dataKey="bin" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} interval={9} tickFormatter={v=>`$${v}B`}/>
                  <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`${v}%`} width={28}/>
                  <Tooltip formatter={(v)=>[`${v.toFixed(3)}%`,"Freq"]} contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}/>
                  <Bar dataKey="freq" radius={[1,1,0,0]}>
                    {qHistData.map((_,i)=><Cell key={i} fill={i<qHistData.length*.65?C.teal:i<qHistData.length*.88?C.lavender:C.rose} fillOpacity={0.78}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:8}}>
                <tbody>
                  {[["Mean",qSimStats.mean,"teal"],["p75",qSimStats.p75,"sage"],
                    ["p90",qSimStats.p90,"lavender"],["p99",qSimStats.p99,"rose"]].map(([l,v,c])=>(
                    <tr key={l} style={{borderBottom:`1px solid ${C.dim}`}}>
                      <td style={{padding:"4px 8px",color:C.muted,fontSize:10}}>{l}</td>
                      <td style={{padding:"4px 8px",color:C[c],textAlign:"right",fontWeight:600}}>${v}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ):(
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",
              display:"flex",alignItems:"center",justifyContent:"center",flex:1,color:C.muted,fontSize:11,textAlign:"center",minHeight:120}}>
              Run Q-SIM to see quarterly-composed distribution
            </div>
          )}
        </div>
      </div>

      {/* QUARTERLY TIME SERIES per quarter */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>QUARTERLY LOSS SERIES — EACH QUARTER INDEPENDENTLY</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart margin={{top:5,right:8,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
            <XAxis dataKey="year" type="number" domain={[yearFrom,yearTo]} stroke={C.border2} tick={{fill:C.muted,fontSize:10}}/>
            <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}
              formatter={(v,n)=>[`$${v.toFixed(1)}B`,n]}/>
            <Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
            {[1,2,3,4].map(q=>(
              <Line key={q} data={qScatter[q]} dataKey="loss" type="monotone"
                stroke={qColors[q]} strokeWidth={1.5} dot={{r:2,fill:qColors[q]}}
                name={qNames[q]} connectNulls/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

/* ── Q-KALSHI 2026 ───────────────────────────────────────────────────────── */
const Q_HIST = {"1": {"vals": [3.38, 3.75, 5.22, 6.28, 10.5, 13.55, 13.72, 14.84, 14.97, 17.85, 17.99, 20.29, 20.95, 22.5, 28.0, 28.6, 28.66, 36.35, 44.47, 48.43, 63.73, 76.27, 76.96, 77.88, 336.08], "mu": 3.1304, "sigma": 1.0293, "lam": 85.0, "mean": 41.2, "std": 64.3, "p25": 13.7, "p50": 21.0, "p75": 44.5, "p90": 76.7}, "2": {"vals": [11.11, 12.61, 13.48, 13.9, 14.52, 15.09, 19.98, 22.08, 24.52, 29.37, 34.39, 37.58, 42.12, 44.22, 44.97, 50.49, 56.25, 56.29, 58.65, 61.3, 71.18, 81.32, 93.45, 104.53, 157.41], "mu": 3.5925, "sigma": 0.727, "lam": 92.16, "mean": 46.8, "std": 34.2, "p25": 20.0, "p50": 42.1, "p75": 58.6, "p90": 88.6}, "3": {"vals": [14.29, 21.62, 21.93, 23.95, 36.29, 36.46, 37.71, 42.28, 44.11, 44.81, 51.15, 53.1, 56.39, 59.5, 62.52, 63.44, 67.31, 67.95, 90.6, 97.59, 124.19, 136.72, 147.78, 265.41, 336.99], "mu": 4.0844, "sigma": 0.7394, "lam": 115.04, "mean": 80.2, "std": 74.2, "p25": 37.7, "p50": 56.4, "p75": 90.6, "p90": 143.4}, "4": {"vals": [3.09, 3.92, 8.19, 8.27, 9.93, 10.42, 11.39, 13.22, 14.07, 14.31, 17.8, 19.62, 20.37, 22.07, 26.39, 31.95, 32.5, 33.03, 33.52, 33.66, 42.14, 51.69, 52.12, 72.0, 74.42], "mu": 2.9841, "sigma": 0.811, "lam": 81.28, "mean": 26.4, "std": 19.2, "p25": 11.4, "p50": 20.4, "p75": 33.5, "p90": 51.9}};
const DEFAULT_Q_STRIKES = {"1": [10, 20, 30, 50, 75, 100], "2": [15, 25, 40, 60, 80, 120], "3": [30, 50, 75, 100, 150, 200, 300], "4": [10, 15, 25, 40, 60, 80]};
const DEFAULT_YTD_STRIKES = {"1": [15, 30, 50, 80, 120], "2": [40, 70, 100, 150, 200], "3": [80, 130, 180, 250, 350], "4": [100, 180, 260, 350, 500]};

const Q_NAMES  = {1:"Q1 Jan–Mar",2:"Q2 Apr–Jun",3:"Q3 Jul–Sep",4:"Q4 Oct–Dec"};
const Q_COLORS = {1:C.teal,2:C.sage,3:C.rose,4:C.lavender};
const FEAR_Q   = 1.7;

function runQSimSingle(qNum, overrides, nSim=30000){
  // Quarterly TOTAL modelled as single lognormal draw.
  // mu/sigma fit to historical quarterly aggregate losses (25 observations per quarter).
  // One draw = one simulated quarter total. No compound Poisson — lambda is event-count,
  // not appropriate as a Poisson rate here.
  const d   = Q_HIST[qNum];
  const mu  = overrides?.mu    ?? d.mu;
  const sig = overrides?.sigma ?? d.sigma;
  return Array.from({length:nSim},()=>{
    const u = Math.max(Math.random(), 1e-10);
    const v = Math.random();
    return Math.exp(mu + sig * Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v));
  });
}

function exceedProb(sim, strike){ return sim.filter(v=>v>strike).length/sim.length; }
function qKellyBuy(trueP, yesP){ if(yesP<=0||yesP>=1)return 0; const b=(1-yesP)/yesP; return Math.max(0,trueP-(1-trueP)/b); }
function qKellySell(trueP, yesP){ if(yesP<=0||yesP>=1)return 0; const b=yesP/(1-yesP); return Math.max(0,(1-trueP)-trueP/b); }

function QKalshiTab(){
  const [notional,     setNotional]     = useState(10000);
  const [contractMode, setContractMode] = useState("both");
  const [simCache,     setSimCache]     = useState({});
  const [simDone,      setSimDone]      = useState(false);
  const [simRunning,   setSimRunning]   = useState(false);
  const [posSize,      setPosSize]      = useState({});
  const [qov,          setQov]          = useState({1:{},2:{},3:{},4:{}});
  const [ytdActual,    setYtdActual]    = useState({1:null,2:null,3:null,4:null});

  const setQP = (q,k,v)=>setQov(o=>{const n={...o};n[q]={...n[q],[k]:parseFloat(v)||undefined};return n;});

  const runAllSims = ()=>{
    setSimRunning(true); setSimDone(false);
    setTimeout(()=>{
      const cache={};
      for(const q of [1,2,3,4]) cache[q]=runQSimSingle(q, qov[q], 30000);
      setSimCache(cache); setSimDone(true); setSimRunning(false);
    },80);
  };

  const buildRows = (sim, strikes, keyPfx)=>{
    return strikes.map(strike=>{
      const trueP    = exceedProb(sim, strike);
      const implP    = Math.min(trueP*FEAR_Q, 0.99);
      const yesPrice = implP;
      const pos      = trueP>implP ? "BUY_YES" : "SELL_YES";
      const edge     = pos==="BUY_YES" ? trueP-implP : implP-trueP;
      const kelly    = pos==="BUY_YES" ? qKellyBuy(trueP,yesPrice) : qKellySell(trueP,yesPrice);
      const n        = posSize[keyPfx+"_"+strike] ?? 50;
      const collects = pos==="SELL_YES" ? yesPrice*n*notional/100 : (1-yesPrice)*n*notional/100;
      const maxLoss  = pos==="SELL_YES" ? (1-yesPrice)*n*notional/100 : yesPrice*n*notional/100;
      const ev       = edge*n*notional/100;
      const strength = edge>0.15?"strong":edge>0.05?"good":edge>0.01?"marginal":"skip";
      return{strike,trueP,implP,yesPrice,pos,edge,kelly,n,collects,maxLoss,ev,strength};
    });
  };

  const qRows = useMemo(()=>{
    if(!simDone) return {};
    const out={};
    for(const q of [1,2,3,4]) out[q]=buildRows(simCache[q]||[], DEFAULT_Q_STRIKES[q]||[], "q"+q);
    return out;
  },[simDone,simCache,posSize,notional]);

  const ytdRows = useMemo(()=>{
    if(!simDone) return {};
    const nSim=30000;
    const out={};
    for(const q of [1,2,3,4]){
      const combined=Array.from({length:nSim},(_,i)=>{
        let tot=0;
        for(let qq=1;qq<=q;qq++){
          if(ytdActual[qq]!=null){tot+=parseFloat(ytdActual[qq])||0;continue;}
          tot+=(simCache[qq]||Array(nSim).fill(0))[i%30000]||0;
        }
        return tot;
      });
      const known=[1,2,3,4].filter(qq=>qq<=q&&ytdActual[qq]!=null);
      const knownSum=known.reduce((a,qq)=>a+(parseFloat(ytdActual[qq])||0),0);
      out[q]={rows:buildRows(combined, DEFAULT_YTD_STRIKES[q]||[], "ytd"+q), known, knownSum};
    }
    return out;
  },[simDone,simCache,posSize,notional,ytdActual]);

  const totalBookEV = useMemo(()=>{
    let ev=0;
    if(contractMode!=="ytd") Object.values(qRows).flat().forEach(r=>ev+=r.ev||0);
    if(contractMode!=="qspecific") Object.values(ytdRows).forEach(o=>(o.rows||[]).forEach(r=>ev+=r.ev||0));
    return ev;
  },[qRows,ytdRows,contractMode]);

  const scColor={strong:C.sage,good:C.teal,marginal:C.lavender,skip:C.dim};
  const inp4={background:C.bg,border:`1px solid ${C.border2}`,borderRadius:4,color:C.text,
    padding:"4px 8px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none"};
  const posInp={background:C.dim,border:`1px solid ${C.border2}`,borderRadius:4,color:C.white,
    padding:"3px 5px",fontSize:11,width:55,textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",outline:"none"};

  const ContractTable = ({rows, keyPfx})=>{
    if(!rows?.length) return <div style={{padding:"12px",color:C.muted,fontSize:11,textAlign:"center"}}>Run Q-Sim to price contracts</div>;
    return(
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:`1px solid ${C.border2}`}}>
          {["STRIKE","YES¢","TRUE%","EDGE","KELLY","POS","# CTRS","COLLECT","MAX LOSS","EV","STR"].map(h=>(
            <th key={h} style={{padding:"5px 8px",color:C.muted,fontWeight:500,textAlign:"right",fontSize:9,whiteSpace:"nowrap"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{rows.map(r=>{
          const posCol = r.pos==="BUY_YES" ? C.sage : C.rose;
          const k = keyPfx+"_"+r.strike;
          return(
            <tr key={r.strike} style={{borderBottom:`1px solid ${C.dim}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.dim}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"7px 8px",color:"#c4956a",textAlign:"right",fontWeight:600}}>${r.strike}B</td>
              <td style={{padding:"7px 8px",textAlign:"right"}}>
                <span style={{background:posCol+"18",border:"1px solid "+posCol+"44",borderRadius:3,
                  color:posCol,padding:"1px 6px",fontWeight:600}}>{(r.yesPrice*100).toFixed(1)}¢</span>
              </td>
              <td style={{padding:"7px 8px",color:C.teal,textAlign:"right"}}>{(r.trueP*100).toFixed(2)}%</td>
              <td style={{padding:"7px 8px",color:r.edge>0.05?C.sage:C.muted,textAlign:"right",fontWeight:600}}>{(r.edge*100).toFixed(1)}¢</td>
              <td style={{padding:"7px 8px",color:C.lavender,textAlign:"right"}}>{(r.kelly*100).toFixed(1)}%</td>
              <td style={{padding:"7px 8px",textAlign:"right"}}>
                <span style={{color:posCol,fontSize:10,fontWeight:600}}>{r.pos==="BUY_YES" ? "↑ BUY" : "↓ SELL"}</span>
              </td>
              <td style={{padding:"7px 8px",textAlign:"right"}}>
                <input type="number" min={0} step={10} value={posSize[k]??50}
                  onChange={e=>setPosSize(p=>({...p,[k]:+e.target.value}))} style={posInp}/>
              </td>
              <td style={{padding:"7px 8px",color:C.teal,textAlign:"right"}}>${r.collects.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
              <td style={{padding:"7px 8px",color:C.rose,textAlign:"right"}}>${r.maxLoss.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
              <td style={{padding:"7px 8px",color:r.ev>0?C.sage:C.muted,textAlign:"right",fontWeight:700}}>${r.ev.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
              <td style={{padding:"7px 8px",textAlign:"right",color:scColor[r.strength],fontSize:10,fontWeight:600}}>
                {r.strength==="strong"?"▲":r.strength==="good"?"●":r.strength==="marginal"?"→":"—"}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* CONTROLS */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px",
        display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>CONTRACTS</span>
          {[["qspecific","Q-SPECIFIC"],["ytd","YTD CUMULATIVE"],["both","BOTH"]].map(([k,l])=>(
            <button key={k} style={{background:contractMode===k?C.teal+"18":"transparent",
              border:`1px solid ${contractMode===k?C.teal:C.border}`,borderRadius:5,
              color:contractMode===k?C.teal:C.muted,padding:"4px 12px",fontSize:11,
              cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace"}}
              onClick={()=>setContractMode(k)}>{l}</button>
          ))}
        </div>
        <div style={{width:1,height:24,background:C.border}}/>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.muted}}>SIZE ($/CONTRACT)</span>
          <input type="number" value={notional} min={100} step={100}
            onChange={e=>setNotional(+e.target.value)} style={{...inp4,width:88}}/>
        </div>
        <button onClick={runAllSims} disabled={simRunning} style={{
          background:simRunning?C.dim:C.teal+"18",border:`1px solid ${simRunning?C.border:C.teal}`,
          borderRadius:6,color:simRunning?C.muted:C.teal,padding:"7px 20px",fontSize:12,
          cursor:simRunning?"not-allowed":"pointer",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>
          {simRunning?"COMPUTING...":simDone?"RE-RUN ↺":"RUN Q-SIM ▶"}
        </button>
        {simDone&&<div style={{marginLeft:"auto",fontSize:11}}>
          <span style={{color:C.muted}}>BOOK EV </span>
          <span style={{color:totalBookEV>0?C.sage:C.rose,fontWeight:700}}>
            ${totalBookEV.toLocaleString(undefined,{maximumFractionDigits:0})}
          </span>
        </div>}
      </div>

      {/* Q PARAM OVERRIDES */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>
          PER-QUARTER MODEL OVERRIDES — adjust before running sim
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[1,2,3,4].map(q=>{
            const d=Q_HIST[q]; const col=Q_COLORS[q]; const ov=qov[q];
            return(
              <div key={q} style={{border:`1px solid ${Object.keys(ov).length>0?col:C.dim}`,borderRadius:6,padding:"10px"}}>
                <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:8}}>{Q_NAMES[q]}</div>
                {[["mu","μ log-mean",1,9,0.05],["sigma","σ log-sigma",0.1,3,0.05]].map(([k,lbl,mn,mx,st])=>(
                  <div key={k} style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted,marginBottom:2}}>
                      <span>{lbl}</span><span style={{color:C.dim}}>data:{d[k==="lam"?"lam":k==="mu"?"mu":"sigma"]}</span>
                    </div>
                    <input type="number" step={st} min={mn} max={mx}
                      value={ov[k]??d[k==="lam"?"lam":k==="mu"?"mu":"sigma"]}
                      onChange={e=>setQP(q,k,e.target.value)}
                      style={{background:C.bg,border:`1px solid ${ov[k]!=null?col:C.border2}`,borderRadius:3,
                        color:ov[k]!=null?col:C.text,padding:"3px 6px",fontSize:11,width:"100%",
                        textAlign:"center",fontFamily:"'IBM Plex Mono',monospace",outline:"none"}}/>
                  </div>
                ))}
                {Object.keys(ov).length>0&&
                  <button onClick={()=>setQov(o=>({...o,[q]:{}}))}
                    style={{marginTop:4,background:"transparent",border:`1px solid ${C.border}`,
                      borderRadius:3,color:C.muted,fontSize:9,padding:"2px 8px",cursor:"pointer",
                      fontFamily:"'IBM Plex Mono',monospace",width:"100%"}}>RESET</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* YTD ACTUALS */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>
          2026 ACTUALS — lock in known quarterly losses to sharpen forward YTD pricing
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}> 
          {[1,2,3,4].map(q=>{
            const col=Q_COLORS[q]; const isKnown=ytdActual[q]!=null;
            return(
              <div key={q} style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:col,minWidth:100}}>{Q_NAMES[q]}</span>
                <input type="number" step="1" min="0" placeholder="actual $B"
                  value={ytdActual[q]??""}
                  onChange={e=>setYtdActual(a=>({...a,[q]:e.target.value?parseFloat(e.target.value):null}))}
                  style={{...inp4,width:90,borderColor:isKnown?col+"88":C.border2,color:isKnown?col:C.text}}/>
                {isKnown&&<span style={{fontSize:10,color:col}}>✓ LOCKED</span>}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:8,fontSize:10,color:C.dim}}>
          Entering Q1 actuals collapses that quarter's uncertainty — YTD contracts update automatically.
        </div>
      </div>

      {/* Q-SPECIFIC CONTRACT TABLES */}
      {(contractMode==="qspecific"||contractMode==="both")&&[1,2,3,4].map(q=>{
        const col=Q_COLORS[q];
        const rows=qRows[q]||[];
        const qEV=rows.reduce((a,r)=>a+(r.ev||0),0);
        return(
          <div key={q} style={{background:C.panel,border:`1px solid ${col}44`,borderRadius:8,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div>
                <span style={{fontSize:11,color:col,fontWeight:700}}>{Q_NAMES[q]} 2026 — Q-SPECIFIC</span>
                <span style={{fontSize:10,color:C.muted,marginLeft:10}}>"Will {Q_NAMES[q]} losses exceed $X?"</span>
              </div>
              <div style={{display:"flex",gap:16,fontSize:11}}>
                <span><span style={{color:C.muted}}>Hist p50 </span><span style={{color:col}}>${Q_HIST[q].p50}B</span></span>
                <span><span style={{color:C.muted}}>Hist p90 </span><span style={{color:col}}>${Q_HIST[q].p90}B</span></span>
                {simDone&&<span><span style={{color:C.muted}}>EV </span>
                  <span style={{color:qEV>0?C.sage:C.muted,fontWeight:700}}>${qEV.toLocaleString(undefined,{maximumFractionDigits:0})}</span></span>}
              </div>
            </div>
            <ContractTable rows={rows} keyPfx={"q"+q}/>
          </div>
        );
      })}

      {/* YTD CUMULATIVE CONTRACT TABLES */}
      {(contractMode==="ytd"||contractMode==="both")&&[1,2,3,4].map(q=>{
        const col=Q_COLORS[q];
        const data=ytdRows[q]||{rows:[],known:[],knownSum:0};
        const qEV=(data.rows||[]).reduce((a,r)=>a+(r.ev||0),0);
        return(
          <div key={"ytd"+q} style={{background:C.panel,border:`1px solid ${col}33`,borderRadius:8,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <div>
                <span style={{fontSize:11,color:col,fontWeight:700}}>YTD THROUGH {Q_NAMES[q].toUpperCase()} 2026</span>
                <span style={{fontSize:10,color:C.muted,marginLeft:10}}>"Will cumulative 2026 losses through Q{q} exceed $X?"</span>
                {data.known.length>0&&<span style={{fontSize:10,color:C.teal,marginLeft:8}}>
                  ({data.known.length} locked · ${data.knownSum.toFixed(0)}B known)
                </span>}
              </div>
              {simDone&&<span><span style={{color:C.muted,fontSize:11}}>EV </span>
                <span style={{color:qEV>0?C.sage:C.muted,fontWeight:700,fontSize:11}}>${qEV.toLocaleString(undefined,{maximumFractionDigits:0})}</span></span>}
            </div>
            <ContractTable rows={data.rows||[]} keyPfx={"ytd"+q}/>
          </div>
        );
      })}

    </div>
  );
}


/* ── HURRICANE SEASON MARKET ─────────────────────────────────────────────── */
const HURR_ANNUAL  = [{"year": 2000, "loss_B": 16.235541}, {"year": 2001, "loss_B": 23.461268}, {"year": 2002, "loss_B": 13.03323}, {"year": 2003, "loss_B": 15.524583}, {"year": 2004, "loss_B": 132.359107}, {"year": 2005, "loss_B": 285.482258}, {"year": 2006, "loss_B": 17.186931}, {"year": 2007, "loss_B": 21.580686}, {"year": 2008, "loss_B": 65.013784}, {"year": 2009, "loss_B": 10.123083}, {"year": 2010, "loss_B": 12.528404}, {"year": 2011, "loss_B": 17.218157}, {"year": 2012, "loss_B": 78.93024199999999}, {"year": 2013, "loss_B": 38.484716999999996}, {"year": 2014, "loss_B": 25.538769}, {"year": 2015, "loss_B": 17.106309}, {"year": 2016, "loss_B": 29.270755}, {"year": 2017, "loss_B": 312.106535}, {"year": 2018, "loss_B": 72.962366}, {"year": 2019, "loss_B": 57.65282}, {"year": 2020, "loss_B": 49.403715}, {"year": 2021, "loss_B": 83.36416799999999}, {"year": 2022, "loss_B": 114.868342}, {"year": 2023, "loss_B": 43.72498}, {"year": 2024, "loss_B": 122.53868}, {"year": 2025, "loss_B": 0.0}];
const HURR_PARAMS  = {"mu": 3.7115, "sigma": 0.9585, "mean": 67.0, "median": 38.5, "p50": 38.5, "p75": 78.9, "p90": 128.4, "p95": 254.9, "max": 312.1, "n": 25};
const HURR_STRIKES = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400];

function runHurrSim(mu, sigma, nSim){
  return Array.from({length:nSim},()=>{
    const u=Math.max(Math.random(),1e-10), v=Math.random();
    return Math.exp(mu + sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v));
  });
}

function HurricaneTab(){
  const [mu,       setMu]       = useState(HURR_PARAMS.mu);
  const [sigma,    setSigma]    = useState(HURR_PARAMS.sigma);
  const [nSimH,    setNSimH]    = useState(40000);
  const [sim,      setSim]      = useState([]);
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [notional, setNotional] = useState(10000);
  const [posSize,  setPosSize]  = useState({});
  const [actualYTD,setActualYTD]= useState("");
  const [fearMult, setFearMult] = useState(1.7);
  const [elNino,   setElNino]   = useState(false);
  const [laNina,   setLaNina]   = useState(false);

  const climateAdj = elNino ? -0.30 : laNina ? 0.25 : 0.0;
  const adjMu      = +(mu + climateAdj).toFixed(4);

  const runSim = ()=>{
    setRunning(true); setDone(false);
    setTimeout(()=>{
      let s = runHurrSim(adjMu, sigma, nSimH);
      const ytd = parseFloat(actualYTD)||0;
      if(ytd>0) s = s.map(v=>Math.max(v, ytd));
      setSim(s); setDone(true); setRunning(false);
    },60);
  };

  const rows = useMemo(()=>{
    if(!sim.length) return [];
    return HURR_STRIKES.map(strike=>{
      const trueP    = sim.filter(v=>v>strike).length/sim.length;
      const implP    = Math.min(trueP*fearMult, 0.99);
      const yesPrice = implP;
      const pos      = trueP > yesPrice ? "BUY_YES" : "SELL_YES";
      const edge     = pos==="BUY_YES" ? trueP-yesPrice : yesPrice-trueP;
      const n        = posSize[strike]??50;
      const collects = pos==="SELL_YES" ? yesPrice*n*notional/100 : (1-yesPrice)*n*notional/100;
      const maxLoss  = pos==="SELL_YES" ? (1-yesPrice)*n*notional/100 : yesPrice*n*notional/100;
      const ev       = edge*n*notional/100;
      const histRate = HURR_ANNUAL.filter(r=>r.loss_B>strike).length/HURR_ANNUAL.filter(r=>r.loss_B>0).length*100;
      const strength = edge>0.15?"strong":edge>0.05?"good":edge>0.01?"marginal":"skip";
      return{strike,trueP:trueP*100,implP:implP*100,yesPrice,pos,edge,n,collects,maxLoss,ev,histRate,strength};
    });
  },[sim,posSize,notional,fearMult]);

  const totalEV = rows.reduce((a,r)=>a+r.ev,0);

  const hist = useMemo(()=>{
    if(!sim.length) return [];
    const bins=50,maxV=500,w=maxV/bins,counts=Array(bins).fill(0);
    sim.filter(v=>v<maxV).forEach(v=>counts[Math.min(Math.floor(v/w),bins-1)]++);
    return counts.map((c,i)=>({bin:Math.round(i*w),freq:+(c/sim.length*100).toFixed(3)}));
  },[sim]);

  const exceed = useMemo(()=>{
    if(!sim.length) return [];
    const histValid = HURR_ANNUAL.filter(r=>r.loss_B>0);
    return Array.from({length:50},(_,i)=>{
      const s=10+i*10;
      const t=sim.filter(v=>v>s).length/sim.length*100;
      const h=histValid.filter(r=>r.loss_B>s).length/histValid.length*100;
      return{threshold:s,model:+t.toFixed(2),historical:+h.toFixed(2),implied:+(t*fearMult).toFixed(2)};
    });
  },[sim,fearMult]);

  const scColor={strong:C.sage,good:C.teal,marginal:C.lavender,skip:C.dim};
  const inp={background:C.bg,border:`1px solid ${C.border2}`,borderRadius:4,color:C.text,
    padding:"5px 8px",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",outline:"none"};
  const posInp={background:C.dim,border:`1px solid ${C.border2}`,borderRadius:4,color:C.white,
    padding:"3px 5px",fontSize:11,width:55,textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",outline:"none"};

  const climateActive = elNino||laNina;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* HEADER */}
      <div style={{background:C.panel,border:`1px solid ${C.rose}44`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:13,color:C.rose,fontWeight:700,letterSpacing:"0.5px",marginBottom:4}}>
              Atlantic Hurricane Season — Jun 1 to Nov 30
            </div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>
              25 seasons (2000–2024) · Mean <span style={{color:C.white}}>${HURR_PARAMS.mean}B</span> ·
              Median <span style={{color:C.white}}>${HURR_PARAMS.median}B</span> ·
              Max <span style={{color:C.rose}}>${HURR_PARAMS.max}B</span> (2017)<br/>
              σ=<span style={{color:C.rose,fontWeight:600}}>{HURR_PARAMS.sigma}</span> — one of the fattest tails in catastrophe data.
              5 of 25 seasons exceeded $100B. 2 exceeded $200B.
            </div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            {done&&<div style={{display:"flex",gap:14,fontSize:11}}>
              <span><span style={{color:C.muted}}>SIM MEAN </span><span style={{color:C.teal,fontWeight:700}}>${(sim.reduce((a,b)=>a+b,0)/sim.length).toFixed(0)}B</span></span>
              <span><span style={{color:C.muted}}>p90 </span><span style={{color:C.lavender,fontWeight:700}}>${sim.slice().sort((a,b)=>a-b)[Math.floor(sim.length*0.9)].toFixed(0)}B</span></span>
              <span><span style={{color:C.muted}}>BOOK EV </span><span style={{color:totalEV>0?C.sage:C.rose,fontWeight:700}}>${totalEV.toLocaleString(undefined,{maximumFractionDigits:0})}</span></span>
            </div>}
            <button onClick={runSim} disabled={running} style={{
              background:running?C.dim:`${C.rose}18`,border:`1px solid ${running?C.border:C.rose}`,
              borderRadius:6,color:running?C.muted:C.rose,padding:"7px 20px",fontSize:12,
              cursor:running?"not-allowed":"pointer",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>
              {running?"COMPUTING...":done?"RE-RUN ↺":"RUN SIM ▶"}
            </button>
          </div>
        </div>
      </div>

      {/* MODEL CONTROLS */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>MODEL PARAMETERS</div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,flex:1,minWidth:280}}>
            {[
              ["MU (μ)",mu,setMu,2,7,0.05,C.teal,`e^μ = $${Math.exp(mu).toFixed(0)}B median season`],
              ["SIGMA (σ)",sigma,setSigma,0.3,2.5,0.05,C.rose,"Tail fatness — 2017 type outliers"],
              ["FEAR MULT",fearMult,setFearMult,1.0,3.0,0.05,C.lavender,"Market overprice multiplier"],
              ["SIMULATIONS",nSimH/1000,v=>{setNSimH(Math.round(v)*1000);},10,100,10,C.sage,`${nSimH.toLocaleString()} years`],
            ].map(([lbl,val,setter,mn,mx,st,col,hint])=>(
              <div key={lbl}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:10,color:C.muted,letterSpacing:"0.8px"}}>{lbl}</span>
                  <input type="number" value={val} step={st} min={mn} max={mx}
                    onChange={e=>{setter(parseFloat(e.target.value)||val);setDone(false);}}
                    style={{background:C.dim,border:`1px solid ${col}44`,borderRadius:3,color:col,
                      padding:"2px 6px",fontSize:12,width:65,textAlign:"right",
                      fontFamily:"'IBM Plex Mono',monospace",outline:"none"}}/>
                </div>
                <div style={{position:"relative",height:4,background:C.dim,borderRadius:2,marginBottom:3}}>
                  <div style={{position:"absolute",left:0,top:0,height:"100%",background:col,borderRadius:2,
                    width:`${((val-mn)/(mx-mn)*100).toFixed(1)}%`}}/>
                  <input type="range" min={mn} max={mx} step={st} value={val}
                    onChange={e=>{setter(parseFloat(e.target.value));setDone(false);}}
                    style={{position:"absolute",top:-6,left:0,width:"100%",opacity:0,cursor:"pointer",height:16}}/>
                </div>
                <div style={{fontSize:9,color:C.dim}}>{hint}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,minWidth:190}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>CLIMATE REGIME</div>
            <div style={{background:elNino?`${C.lavender}18`:C.dim,border:`1px solid ${elNino?C.lavender:C.border}`,
              borderRadius:6,padding:"8px 12px",cursor:"pointer"}} onClick={()=>{setElNino(v=>!v);setLaNina(false);setDone(false);}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:elNino?C.lavender:C.muted,fontWeight:elNino?600:400}}>El Niño</span>
                <span style={{fontSize:10,color:elNino?C.lavender:C.dim}}>{elNino?"ON ●":"OFF ○"}</span>
              </div>
              <div style={{fontSize:10,color:C.dim,marginTop:2}}>Suppresses Atlantic ~30%</div>
            </div>
            <div style={{background:laNina?`${C.rose}18`:C.dim,border:`1px solid ${laNina?C.rose:C.border}`,
              borderRadius:6,padding:"8px 12px",cursor:"pointer"}} onClick={()=>{setLaNina(v=>!v);setElNino(false);setDone(false);}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:laNina?C.rose:C.muted,fontWeight:laNina?600:400}}>La Niña</span>
                <span style={{fontSize:10,color:laNina?C.rose:C.dim}}>{laNina?"ON ●":"OFF ○"}</span>
              </div>
              <div style={{fontSize:10,color:C.dim,marginTop:2}}>Enhances Atlantic ~25%</div>
            </div>
            {climateActive&&<div style={{fontSize:10,color:elNino?C.lavender:C.rose,padding:"4px 8px",
              background:C.dim,borderRadius:4,lineHeight:1.5}}>
              μ: {HURR_PARAMS.mu} → {adjMu}<br/>
              Median: ~${Math.exp(adjMu).toFixed(0)}B
            </div>}
            <div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:4}}>YTD ACTUAL ($B)</div>
              <input type="number" min="0" step="1" placeholder="known losses so far"
                value={actualYTD} onChange={e=>{setActualYTD(e.target.value);setDone(false);}}
                style={{...inp,width:"100%"}}/>
              <div style={{fontSize:9,color:C.dim,marginTop:2}}>Floors dist at known total</div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:4}}>SIZE ($/CONTRACT)</div>
              <input type="number" min="100" step="100" value={notional}
                onChange={e=>setNotional(+e.target.value)} style={{...inp,width:"100%"}}/>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS */}
      {done&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>HISTORICAL HURRICANE SEASON LOSSES</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={HURR_ANNUAL.filter(r=>r.loss_B>0)} margin={{top:4,right:8,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                <XAxis dataKey="year" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} interval={2}/>
                <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`$${v}B`}/>
                <Tooltip formatter={v=>[`$${v.toFixed(1)}B`,"Loss"]} contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}/>
                <ReferenceLine y={HURR_PARAMS.mean} stroke={C.teal} strokeDasharray="4 3"
                  label={{value:"Mean",fill:C.teal,fontSize:9,position:"insideTopRight"}}/>
                <Bar dataKey="loss_B" name="Season Loss" radius={[2,2,0,0]}>
                  {HURR_ANNUAL.filter(r=>r.loss_B>0).map((r,i)=>(
                    <Cell key={i} fill={r.loss_B>200?C.rose:r.loss_B>100?C.lavender:r.loss_B>50?C.sage:C.teal} opacity={0.85}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px"}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:8}}>SIMULATED DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={95}>
                <BarChart data={hist} margin={{top:2,right:6,left:0,bottom:2}}>
                  <XAxis dataKey="bin" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} interval={9} tickFormatter={v=>`$${v}B`}/>
                  <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`${v}%`} width={28}/>
                  <Bar dataKey="freq" radius={[1,1,0,0]}>
                    {hist.map((_,i)=><Cell key={i} fill={i<hist.length*.6?C.teal:i<hist.length*.85?C.lavender:C.rose} fillOpacity={0.8}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px"}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:8}}>EXCEEDANCE — MODEL vs HISTORICAL vs IMPLIED</div>
              <ResponsiveContainer width="100%" height={95}>
                <LineChart data={exceed} margin={{top:2,right:6,left:0,bottom:2}}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                  <XAxis dataKey="threshold" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`$${v}B`} interval={4}/>
                  <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`${v}%`} width={28}/>
                  <Tooltip formatter={(v,n)=>[`${v.toFixed(2)}%`,n]} contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}/>
                  <Line dataKey="historical" stroke={C.white}  strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Historical"/>
                  <Line dataKey="model"      stroke={C.teal}   strokeWidth={1.5} dot={false} name="Model"/>
                  <Line dataKey="implied"    stroke={C.rose}   strokeWidth={1}   strokeDasharray="3 2" dot={false} name={`Implied (${fearMult}×)`}/>
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:12,marginTop:5,fontSize:10}}>
                <span><span style={{color:C.white}}>- -</span> <span style={{color:C.muted}}>Historical</span></span>
                <span><span style={{color:C.teal}}>—</span> <span style={{color:C.muted}}>Model</span></span>
                <span><span style={{color:C.rose}}>--</span> <span style={{color:C.muted}}>Implied</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTRACT BOOK */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:14}}>
          HURRICANE SEASON 2026 CONTRACTS — "Will Atlantic hurricane season losses exceed $X?"
        </div>
        {!done?(
          <div style={{textAlign:"center",padding:"20px",color:C.muted,fontSize:11}}>Run simulation to price contracts</div>
        ):(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border2}`}}>
              {["STRIKE","YES¢","TRUE%","HIST%","EDGE","POS","# CTRS","COLLECT","MAX LOSS","EV","STR"].map(h=>(
                <th key={h} style={{padding:"6px 10px",color:C.muted,fontWeight:500,textAlign:"right",fontSize:9,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map(r=>{
              const posCol=r.pos==="BUY_YES"?C.sage:C.rose;
              return(
                <tr key={r.strike} style={{borderBottom:`1px solid ${C.dim}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.dim}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"8px 10px",color:"#c4956a",textAlign:"right",fontWeight:700}}>${r.strike}B</td>
                  <td style={{padding:"8px 10px",textAlign:"right"}}>
                    <span style={{background:posCol+"18",border:"1px solid "+posCol+"44",borderRadius:3,
                      color:posCol,padding:"2px 7px",fontWeight:600}}>{(r.yesPrice*100).toFixed(1)}¢</span>
                  </td>
                  <td style={{padding:"8px 10px",color:C.teal,textAlign:"right"}}>{r.trueP.toFixed(2)}%</td>
                  <td style={{padding:"8px 10px",color:C.muted,textAlign:"right"}}>{r.histRate.toFixed(1)}%</td>
                  <td style={{padding:"8px 10px",color:r.edge>0.05?C.sage:C.muted,textAlign:"right",fontWeight:600}}>{(r.edge*100).toFixed(1)}¢</td>
                  <td style={{padding:"8px 10px",textAlign:"right"}}>
                    <span style={{color:posCol,fontSize:11,fontWeight:600}}>{r.pos==="BUY_YES"?"↑ BUY":"↓ SELL"}</span>
                  </td>
                  <td style={{padding:"8px 10px",textAlign:"right"}}>
                    <input type="number" min={0} step={10} value={posSize[r.strike]??50}
                      onChange={e=>setPosSize(p=>({...p,[r.strike]:+e.target.value}))}
                      style={posInp}/>
                  </td>
                  <td style={{padding:"8px 10px",color:C.teal,textAlign:"right"}}>${r.collects.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"8px 10px",color:C.rose,textAlign:"right"}}>${r.maxLoss.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"8px 10px",color:r.ev>0?C.sage:C.muted,textAlign:"right",fontWeight:700}}>${r.ev.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:scColor[r.strength],fontSize:11,fontWeight:600}}>
                    {r.strength==="strong"?"▲":r.strength==="good"?"●":r.strength==="marginal"?"→":"—"}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

    </div>
  );
}


/* ── KALSHI CONTRACT FORMATTER ────────────────────────────────────────────── */
const KALSHI_FEE = 0.02;

// Kelly for BUYING YES: you pay yesPrice, win noPrice if event happens
function kellyBuyYes(trueP, yesPrice){
  const b = (1 - yesPrice) / yesPrice; // win/loss ratio
  if(b <= 0 || trueP <= 0) return 0;
  return Math.max(0, trueP - ((1 - trueP) / b));
}

// Kelly for SELLING YES: you collect yesPrice, lose noPrice if event happens
function kellySellYes(trueP, yesPrice){
  const noPrice = 1 - yesPrice;
  const b = yesPrice / noPrice; // win/loss ratio for seller
  if(b <= 0) return 0;
  const pWin = 1 - trueP;
  return Math.max(0, pWin - (trueP / b));
}

// Position logic:
// BUY YES  when trueP > yesPrice  → market underprices the event, you're getting value on breach
// SELL YES when yesPrice > trueP  → market overprices the event, you harvest the fear premium
// The crossover is the fair price line

function KalshiTab({ contracts, simDone, sim }){
  const [notional,  setNotional]  = useState(10000);
  const [year,      setYear]      = useState(new Date().getFullYear()+1);
  const [posSize,   setPosSize]   = useState(Object.fromEntries((contracts||[]).map(c=>[c.strike,100])));
  const [threshold, setThreshold] = useState(null); // auto-detect crossover

  const rows = useMemo(()=>{
    if(!contracts?.length) return [];
    return contracts.map(c=>{
      const implCapped = Math.min(c.implP, 99.0);
      const yesPrice   = implCapped / 100;
      const noPrice    = 1 - yesPrice;
      const trueP      = c.trueP / 100;
      const valid      = implCapped < 99 && c.trueP < 95;

      // Core question: is trueP > yesPrice (underprice → buy YES)
      //                or yesPrice > trueP (overprice → sell YES)?
      const buyEdge  = trueP - yesPrice;   // positive = buy YES has edge
      const sellEdge = yesPrice - trueP;   // positive = sell YES has edge
      const position = buyEdge > 0 ? "BUY_YES" : "SELL_YES";

      // financials differ by position
      let kelly, ev, collects, maxLoss, upfront;
      if(position === "BUY_YES"){
        // Pay yesPrice per contract, win $1 if breach
        kelly    = kellyBuyYes(trueP, yesPrice);
        upfront  = yesPrice;                           // cost to enter
        collects = noPrice;                            // profit if WIN
        maxLoss  = yesPrice;                           // lose stake if NO
        ev       = buyEdge;                            // per dollar
      } else {
        // Collect yesPrice, owe $1 if breach
        kelly    = kellySellYes(trueP, yesPrice);
        upfront  = 0;
        collects = yesPrice;                           // collect upfront
        maxLoss  = noPrice;                            // owe if breach
        ev       = sellEdge;                           // per dollar
      }

      const contracts_n = posSize[c.strike] ?? 100;
      const totalUpfront  = upfront  * contracts_n * notional / 100;
      const totalCollects = collects * contracts_n * notional / 100;
      const totalMaxLoss  = maxLoss  * contracts_n * notional / 100;
      const totalEV       = ev       * contracts_n * notional / 100;

      const strength = !valid ? "skip"
        : ev > 0.15 ? "strong"
        : ev > 0.05 ? "good"
        : ev > 0.01 ? "marginal"
        : "skip";

      return{...c, yesPrice, noPrice, trueP, position, buyEdge, sellEdge, ev,
        kelly, totalUpfront, totalCollects, totalMaxLoss, totalEV,
        valid, strength, contracts_n};
    });
  },[contracts, posSize, notional]);

  // Find the crossover strike (where position flips from BUY to SELL)
  const crossover = useMemo(()=>{
    for(let i=1;i<rows.length;i++){
      if(rows[i-1].position==="BUY_YES" && rows[i].position==="SELL_YES") return rows[i].strike;
    }
    return null;
  },[rows]);

  const buyRows  = rows.filter(r=>r.position==="BUY_YES"  && r.valid);
  const sellRows = rows.filter(r=>r.position==="SELL_YES" && r.valid);

  const totalBookEV = rows.reduce((a,r)=>a+(r.valid?r.totalEV:0),0);
  const totalCost   = buyRows.reduce((a,r)=>a+r.totalUpfront,0);
  const totalCollect= sellRows.reduce((a,r)=>a+r.totalCollects,0);

  const strengthColor = {strong:C.sage, good:C.teal, marginal:C.lavender, skip:C.dim};

  if(!simDone) return(
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"40px",textAlign:"center",color:C.muted,fontSize:12}}>
      Run simulation on Market tab first to generate Kalshi contract prices
    </div>
  );

  const inp2={background:C.bg,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,
    padding:"5px 9px",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",outline:"none"};

  const posInp={background:C.dim,border:`1px solid ${C.border2}`,borderRadius:4,color:C.white,
    padding:"3px 6px",fontSize:12,width:65,textAlign:"right",fontFamily:"'IBM Plex Mono',monospace",outline:"none"};

  const tableHeader = (cols) => (
    <tr style={{borderBottom:`1px solid ${C.border2}`}}>
      {cols.map(h=><th key={h} style={{padding:"6px 10px",color:C.muted,fontWeight:500,textAlign:"right",fontSize:9,letterSpacing:"0.5px",whiteSpace:"nowrap"}}>{h}</th>)}
    </tr>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── EXPLAINER ── */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>POSITION LOGIC</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,fontSize:11,lineHeight:1.7}}>
          <div style={{borderLeft:`3px solid ${C.teal}`,paddingLeft:12}}>
            <div style={{color:C.teal,fontSize:10,letterSpacing:"0.8px",marginBottom:4}}>THE CONTRACT</div>
            <span style={{color:C.muted}}>
              "Will NatCat losses exceed <span style={{color:C.white}}>$X</span> in <span style={{color:C.white}}>{year}</span>?"<br/>
              YES = breach · NO = safe<br/>
              Settles at $1.00. Prices in cents.
            </span>
          </div>
          <div style={{borderLeft:`3px solid ${C.sage}`,paddingLeft:12}}>
            <div style={{color:C.sage,fontSize:10,letterSpacing:"0.8px",marginBottom:4}}>BUY YES — LOW STRIKES</div>
            <span style={{color:C.muted}}>
              Market <span style={{color:C.white}}>underprices</span> breach at realistic thresholds.<br/>
              You pay YES price, collect $1 if losses exceed strike.<br/>
              Edge = true prob − YES price.
            </span>
          </div>
          <div style={{borderLeft:`3px solid ${C.rose}`,paddingLeft:12}}>
            <div style={{color:C.rose,fontSize:10,letterSpacing:"0.8px",marginBottom:4}}>SELL YES — HIGH STRIKES</div>
            <span style={{color:C.muted}}>
              Market <span style={{color:C.white}}>overprices</span> fear at tail thresholds.<br/>
              You collect YES price, pay $1 if losses exceed strike.<br/>
              Edge = YES price − true prob.
            </span>
          </div>
        </div>
        {crossover&&(
          <div style={{marginTop:12,padding:"8px 14px",background:C.dim,borderRadius:6,fontSize:11,color:C.muted,display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:C.lavender,fontWeight:600}}>CROSSOVER</span>
            <span>Position flips at <span style={{color:C.white,fontWeight:600}}>${crossover}B</span> — below this Buy YES, above this Sell YES.</span>
          </div>
        )}
      </div>

      {/* ── CONTROLS ── */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"13px 18px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>CONTRACT YEAR</span>
          <input type="number" value={year} min={2025} max={2035} style={{...inp2,width:68}} onChange={e=>setYear(+e.target.value)}/>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>SIZE ($/CONTRACT)</span>
          <input type="number" value={notional} min={100} step={100} style={{...inp2,width:88}} onChange={e=>setNotional(+e.target.value)}/>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:20,fontSize:11}}>
          <div><span style={{color:C.muted}}>BOOK EV </span><span style={{color:totalBookEV>0?C.sage:C.rose,fontWeight:700}}>${totalBookEV.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>
          <div><span style={{color:C.muted}}>BUY COST </span><span style={{color:C.rose,fontWeight:700}}>${totalCost.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>
          <div><span style={{color:C.muted}}>SELL COLLECTS </span><span style={{color:C.teal,fontWeight:700}}>${totalCollect.toLocaleString(undefined,{maximumFractionDigits:0})}</span></div>
        </div>
      </div>

      {/* ── BUY YES TABLE ── */}
      <div style={{background:C.panel,border:`1px solid ${C.sage}44`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{fontSize:10,color:C.sage,letterSpacing:"1px",fontWeight:600}}>↑ BUY YES — LOSSES LIKELY TO BREACH</div>
          <span style={{fontSize:10,color:C.muted}}>market underprices at these strikes · you profit if losses exceed threshold</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>{tableHeader(["CONTRACT","YES PRICE","TRUE PROB","UNDERPRICE","KELLY","# CTRS","YOU PAY","WIN IF BREACH","EXP PROFIT","STRENGTH"])}</thead>
            <tbody>
              {buyRows.length===0&&<tr><td colSpan={10} style={{padding:"16px",textAlign:"center",color:C.muted,fontSize:11}}>No underpriced strikes in current simulation</td></tr>}
              {buyRows.map(r=>(
                <tr key={r.strike} style={{borderBottom:`1px solid ${C.dim}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.dim}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"9px 10px",textAlign:"left"}}>
                    <div style={{color:C.white,fontWeight:600}}>NatCat {">"} ${r.strike.toLocaleString()}B</div>
                    <div style={{color:C.muted,fontSize:10}}>{year} · BUY YES</div>
                  </td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <span style={{background:`${C.sage}18`,border:`1px solid ${C.sage}44`,borderRadius:4,color:C.sage,padding:"2px 8px",fontWeight:600}}>
                      {(r.yesPrice*100).toFixed(1)}¢
                    </span>
                  </td>
                  <td style={{padding:"9px 10px",color:C.teal,textAlign:"right"}}>{(r.trueP*100).toFixed(2)}%</td>
                  <td style={{padding:"9px 10px",color:C.sage,textAlign:"right",fontWeight:600}}>+{(r.buyEdge*100).toFixed(1)}¢</td>
                  <td style={{padding:"9px 10px",color:C.lavender,textAlign:"right"}}>{(r.kelly*100).toFixed(1)}%</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <input type="number" min={0} step={10} value={posSize[r.strike]??100}
                      onChange={e=>setPosSize(p=>({...p,[r.strike]:+e.target.value}))} style={posInp}/>
                  </td>
                  <td style={{padding:"9px 10px",color:C.rose,textAlign:"right"}}>−${r.totalUpfront.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"9px 10px",color:C.sage,textAlign:"right",fontWeight:600}}>+${r.totalCollects.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"9px 10px",color:r.totalEV>0?C.sage:C.muted,textAlign:"right",fontWeight:700}}>
                    ${r.totalEV.toLocaleString(undefined,{maximumFractionDigits:0})}
                  </td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <span style={{color:strengthColor[r.strength],fontSize:11,fontWeight:600}}>
                      {r.strength==="strong"?"▲ Strong":r.strength==="good"?"● Good":r.strength==="marginal"?"→ Mod":"▽ Thin"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SELL YES TABLE ── */}
      <div style={{background:C.panel,border:`1px solid ${C.rose}44`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{fontSize:10,color:C.rose,letterSpacing:"1px",fontWeight:600}}>↓ SELL YES — FEAR PREMIUM INFLATED</div>
          <span style={{fontSize:10,color:C.muted}}>market overprices tail risk · you collect premium, profit if losses stay below threshold</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>{tableHeader(["CONTRACT","YES PRICE","TRUE PROB","OVERPRICE","KELLY","# CTRS","YOU COLLECT","MAX LOSS","EXP PROFIT","STRENGTH"])}</thead>
            <tbody>
              {sellRows.length===0&&<tr><td colSpan={10} style={{padding:"16px",textAlign:"center",color:C.muted,fontSize:11}}>No overpriced strikes in current simulation</td></tr>}
              {sellRows.map(r=>(
                <tr key={r.strike} style={{borderBottom:`1px solid ${C.dim}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.dim}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"9px 10px",textAlign:"left"}}>
                    <div style={{color:C.white,fontWeight:600}}>NatCat {">"} ${r.strike.toLocaleString()}B</div>
                    <div style={{color:C.muted,fontSize:10}}>{year} · SELL YES</div>
                  </td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <span style={{background:`${C.rose}18`,border:`1px solid ${C.rose}44`,borderRadius:4,color:C.rose,padding:"2px 8px",fontWeight:600}}>
                      {(r.yesPrice*100).toFixed(1)}¢
                    </span>
                  </td>
                  <td style={{padding:"9px 10px",color:C.teal,textAlign:"right"}}>{(r.trueP*100).toFixed(2)}%</td>
                  <td style={{padding:"9px 10px",color:C.rose,textAlign:"right",fontWeight:600}}>+{(r.sellEdge*100).toFixed(1)}¢</td>
                  <td style={{padding:"9px 10px",color:C.lavender,textAlign:"right"}}>{(r.kelly*100).toFixed(1)}%</td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <input type="number" min={0} step={10} value={posSize[r.strike]??100}
                      onChange={e=>setPosSize(p=>({...p,[r.strike]:+e.target.value}))} style={posInp}/>
                  </td>
                  <td style={{padding:"9px 10px",color:C.teal,textAlign:"right",fontWeight:600}}>+${r.totalCollects.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"9px 10px",color:C.rose,textAlign:"right"}}>−${r.totalMaxLoss.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                  <td style={{padding:"9px 10px",color:r.totalEV>0?C.sage:C.muted,textAlign:"right",fontWeight:700}}>
                    ${r.totalEV.toLocaleString(undefined,{maximumFractionDigits:0})}
                  </td>
                  <td style={{padding:"9px 10px",textAlign:"right"}}>
                    <span style={{color:strengthColor[r.strength],fontSize:11,fontWeight:600}}>
                      {r.strength==="strong"?"▲ Strong":r.strength==="good"?"● Good":r.strength==="marginal"?"→ Mod":"▽ Thin"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VISUALISER ── */}
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"16px 18px"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>MISPRICING MAP — TRUE PROBABILITY vs YES PRICE ACROSS STRIKES</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {rows.filter(r=>r.valid).map(r=>{
            const isBuy  = r.position==="BUY_YES";
            const scale  = 100; // 100% = full bar width
            const trueW  = Math.min(r.trueP*100, 99);
            const yesW   = Math.min(r.yesPrice*100, 99);
            const posColor = isBuy ? C.sage : C.rose;
            return(
              <div key={r.strike} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{minWidth:88,textAlign:"right",fontSize:11,color:"#c4956a",fontWeight:600}}>${r.strike.toLocaleString()}B</div>
                <div style={{width:44,textAlign:"center"}}>
                  <span style={{fontSize:10,color:posColor,border:`1px solid ${posColor}44`,borderRadius:3,padding:"1px 6px"}}>
                    {isBuy?"BUY":"SELL"}
                  </span>
                </div>
                <div style={{flex:1,position:"relative",height:18,background:C.dim,borderRadius:3,overflow:"hidden"}}>
                  {/* background zone */}
                  <div style={{position:"absolute",left:0,top:0,height:"100%",
                    width:`${isBuy?yesW:yesW}%`,
                    background:isBuy?`${C.sage}30`:`${C.rose}30`,borderRadius:3}}/>
                  {/* true prob */}
                  <div style={{position:"absolute",left:0,top:"20%",height:"60%",width:`${trueW}%`,
                    background:C.teal,borderRadius:2,transition:"width .3s"}}/>
                  {/* yes price marker */}
                  <div style={{position:"absolute",top:0,height:"100%",
                    left:`${yesW}%`,width:2,background:posColor,opacity:0.9}}/>
                  <div style={{position:"absolute",right:6,top:1,fontSize:9,color:C.lavender}}>
                    {isBuy?`underprice +${(r.buyEdge*100).toFixed(1)}¢`:`overprice +${(r.sellEdge*100).toFixed(1)}¢`}
                  </div>
                </div>
                <div style={{minWidth:80,fontSize:10,color:C.muted,textAlign:"right"}}>
                  <span style={{color:C.teal}}>{(r.trueP*100).toFixed(1)}¢</span>
                  <span style={{color:C.muted}}>{" true · "}</span>
                  <span style={{color:posColor}}>{(r.yesPrice*100).toFixed(1)}¢</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:16,marginTop:10,fontSize:10}}>
          <span><span style={{color:C.teal}}>━</span> <span style={{color:C.muted}}>True prob</span></span>
          <span><span style={{color:C.sage}}>│</span> <span style={{color:C.muted}}>YES price (buy zone)</span></span>
          <span><span style={{color:C.rose}}>│</span> <span style={{color:C.muted}}>YES price (sell zone)</span></span>
          {crossover&&<span style={{marginLeft:"auto",color:C.lavender}}>Crossover: ${crossover}B</span>}
        </div>
      </div>

    </div>
  );
}

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
  const tabBtn=(a)=>({background:"transparent",border:"none",borderBottom:`2px solid ${a?C.teal:"transparent"}`,color:a?C.white:C.muted,padding:"10px 10px",fontSize:11,cursor:"pointer",letterSpacing:"0.3px",fontFamily:"'IBM Plex Mono',monospace",transition:"all .15s",whiteSpace:"nowrap"});
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
          {[["market","Market"],["quarterly","Quarterly"],["contracts","Contracts"],["kalshi","Kalshi"],["qkalshi","Q-Kalshi"],["hurricane","Hurricane"],["compare","Sources"]].map(([k,l])=>(
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

        {/* ── MARKET TAB ── */}
        {activeTab==="market"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={card()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:10,color:C.muted,letterSpacing:"1px"}}>ANNUAL LOSSES — {disType==="All"?"ALL":disType.toUpperCase()}</div>
                <div style={{display:"flex",gap:6}}>
                  {["aggregate","perType"].map(m=>(
                    <button key={m} style={pill(chartMode===m,C.teal)} onClick={()=>setChartMode(m)}>
                      {m==="aggregate"?"TOTAL":"BY TYPE"}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                {chartMode==="aggregate"?(
                  <AreaChart data={annualData} margin={{top:5,right:8,left:0,bottom:5}}>
                    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={src.color} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={src.color} stopOpacity={0}/>
                    </linearGradient></defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                    <XAxis dataKey="year" stroke={C.border2} tick={{fill:C.muted,fontSize:10}}/>
                    <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
                    <Tooltip content={<ChartTT/>}/>
                    {[100,200,300].map((v,i)=>(
                      <ReferenceLine key={v} y={v} stroke={[C.rose,C.lavender,C.green][i]} strokeDasharray="4 4" strokeOpacity={0.6}
                        label={{value:`$${v}B`,fill:[C.rose,C.lavender,C.green][i],fontSize:9,position:"insideTopRight"}}/>
                    ))}
                    <Area type="monotone" dataKey="total" stroke={src.color} strokeWidth={1.5} fill="url(#g1)" name="Loss"/>
                  </AreaChart>
                ):(
                  <BarChart data={annualData} margin={{top:5,right:8,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                    <XAxis dataKey="year" stroke={C.border2} tick={{fill:C.muted,fontSize:10}}/>
                    <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
                    <Tooltip content={<ChartTT/>}/><Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
                    {activeTypes.map(t=><Bar key={t} dataKey={t} stackId="s" fill={TYPE_C[t]||C.teal} name={t} opacity={0.85}/>)}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {simDone?(
                <>
                  <div style={card()}>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>LOSS DISTRIBUTION — {nSim.toLocaleString()} SIMULATED YEARS</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={histData} margin={{top:2,right:8,left:0,bottom:2}}>
                        <XAxis dataKey="bin" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} interval={9} tickFormatter={v=>`$${v}B`}/>
                        <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`${v}%`} width={32}/>
                        <Tooltip formatter={(v,n)=>[`${v.toFixed(3)}%`,n]} contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}/>
                        <Bar dataKey="freq" name="Frequency" radius={[1,1,0,0]}>
                          {histData.map((_,i)=><Cell key={i} fill={i<histData.length*.65?C.teal:i<histData.length*.88?C.lavender:C.rose} fillOpacity={0.78}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={card()}>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>EXCEEDANCE CURVE</div>
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={exceedance} margin={{top:2,right:8,left:0,bottom:2}}>
                        <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                        <XAxis dataKey="threshold" stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`$${v}B`} interval={5}/>
                        <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`${v}%`} width={32}/>
                        <Tooltip formatter={v=>[`${v.toFixed(3)}%`]} contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}}/>
                        <Line dataKey="true"    stroke={C.teal} strokeWidth={1.5} dot={false} name="True"/>
                        <Line dataKey="implied" stroke={C.rose} strokeWidth={1}   strokeDasharray="4 3" dot={false} name="Implied"/>
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",gap:14,marginTop:6,fontSize:10}}>
                      <span><span style={{color:C.teal}}>—</span> <span style={{color:C.muted}}>True prob</span></span>
                      <span><span style={{color:C.rose}}>- -</span> <span style={{color:C.muted}}>Implied ({FEAR_MULT}× fear)</span></span>
                    </div>
                  </div>
                  <div style={card()}>
                    <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:10}}>RETURN PERIOD</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border2}`}}>
                        {["PERCENTILE","RETURN YR","LOSS ($B)"].map(h=>(
                          <th key={h} style={{padding:"4px 10px",color:C.muted,fontWeight:500,textAlign:"right",fontSize:10}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{pctTable.map(r=>(
                        <tr key={r.pct} style={{borderBottom:`1px solid ${C.dim}`}}>
                          <td style={{padding:"5px 10px",color:C.muted,textAlign:"right"}}>{r.pct}th</td>
                          <td style={{padding:"5px 10px",color:C.muted,textAlign:"right"}}>{r.returnYr} yr</td>
                          <td style={{padding:"5px 10px",color:C.teal,textAlign:"right",fontWeight:600}}>${r.val.toLocaleString()}B</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              ):(
                <div style={{...card(),flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,minHeight:320}}>
                  <div style={{width:44,height:44,borderRadius:"50%",border:`2px solid ${C.border2}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:20}}>⟳</div>
                  <div style={{color:C.muted,fontSize:11,textAlign:"center",lineHeight:1.8}}>Configure MC parameters above<br/>then run simulation</div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ── QUARTERLY TAB ── */}
        {activeTab==="quarterly"&&(
          <QuarterlyTracker
            source={source}
            yearFrom={yearFrom}
            yearTo={yearTo}
            nSim={nSim}
            muLocked={muLocked} muManual={muManual}
            sigLocked={sigLocked} sigManual={sigManual}
            lamLocked={lamLocked} lamManual={lamManual}
          />
        )}

        {/* ── CONTRACTS TAB ── */}
        {activeTab==="contracts"&&(
          <div>
            <div style={{...card(),marginBottom:14}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:12}}>RISK LOAD CONTROLS</div>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{color:C.muted,fontSize:11}}>GLOBAL MULT</span>
                  <input type="number" step="0.1" min="0.1" max="100" value={globalMult}
                    onChange={e=>setGlobalMult(parseFloat(e.target.value)||2.5)}
                    style={{...numInp(70),color:C.teal}}/>
                  <button onClick={applyGlobal} style={pill(false,C.teal)}>APPLY ALL</button>
                </div>
                <div style={{width:1,height:24,background:C.border}}/>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{color:C.muted,fontSize:11}}>ADD STRIKE $</span>
                  <input type="number" value={customStrike} onChange={e=>setCustomStrike(e.target.value)}
                    placeholder="e.g. 5000" style={numInp(110)} onKeyDown={e=>e.key==="Enter"&&addStrike()}/>
                  <button onClick={addStrike} style={pill(false,C.sage)}>+ ADD</button>
                </div>
                <div style={{marginLeft:"auto",fontSize:10,color:C.muted}}>FEAR MULT <span style={{color:C.lavender}}>{FEAR_MULT}×</span></div>
              </div>
            </div>
            {!simDone?(
              <div style={{...card(),textAlign:"center",padding:"32px",color:C.muted,fontSize:12}}>Run simulation on Market tab first</div>
            ):(
              <div style={card()}>
                <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:14}}>CONTRACT BOOK</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{borderBottom:`1px solid ${C.border2}`}}>
                      {["STRIKE","TRUE PROB","IMPLIED","RISK MULT","PURE PREM","RISK PREM","GAP","EDGE",""].map(h=>(
                        <th key={h} style={{padding:"7px 12px",color:C.muted,fontWeight:500,textAlign:"right",fontSize:10}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{contracts.map(c=>{
                      const ec=c.edge==="Strong"?C.sage:c.edge==="Moderate"?C.lavender:C.muted;
                      return(
                        <tr key={c.strike} style={{borderBottom:`1px solid ${C.dim}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.dim}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"8px 12px",color:"#c4956a",textAlign:"right",fontWeight:700}}>${c.strike.toLocaleString()}B</td>
                          <td style={{padding:"8px 12px",color:C.sage,textAlign:"right"}}>{c.trueP.toFixed(3)}%</td>
                          <td style={{padding:"8px 12px",color:C.rose,textAlign:"right"}}>{c.implP.toFixed(3)}%</td>
                          <td style={{padding:"8px 12px",textAlign:"right"}}>
                            <input type="number" step="0.1" min="0.1" max="100"
                              value={riskMults[c.strike]??globalMult}
                              onChange={e=>setRiskMults(m=>({...m,[c.strike]:parseFloat(e.target.value)||globalMult}))}
                              style={{...numInp(60),color:C.teal}}/>
                          </td>
                          <td style={{padding:"8px 12px",color:C.text,textAlign:"right"}}>{c.pure.toFixed(3)}%</td>
                          <td style={{padding:"8px 12px",color:C.teal,textAlign:"right",fontWeight:600}}>{c.risk.toFixed(3)}%</td>
                          <td style={{padding:"8px 12px",color:C.lavender,textAlign:"right",fontWeight:600}}>+{c.gap.toFixed(2)}pp</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:ec,fontSize:11}}>
                            {c.edge==="Strong"?"▲ Strong":c.edge==="Moderate"?"→ Mod":"▽ Thin"}
                          </td>
                          <td style={{padding:"8px 12px",textAlign:"center"}}>
                            <button onClick={()=>setStrikes(s=>s.filter(x=>x!==c.strike))}
                              style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>×</button>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                <div style={{marginTop:16}}>
                  <ResponsiveContainer width="100%" height={155}>
                    <BarChart data={contracts} margin={{top:5,right:10,left:0,bottom:5}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                      <XAxis dataKey="strike" stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
                      <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`${v}%`}/>
                      <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}} formatter={(v,n)=>[`${v.toFixed(3)}%`,n]}/>
                      <Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
                      <Bar dataKey="trueP" name="True Prob" fill={C.sage}     opacity={0.8} radius={[2,2,0,0]}/>
                      <Bar dataKey="risk"  name="Premium"   fill={C.teal}     opacity={0.8} radius={[2,2,0,0]}/>
                      <Bar dataKey="gap"   name="Gap"       fill={C.lavender} opacity={0.75} radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}


        {/* ── KALSHI TAB ── */}
        {activeTab==="kalshi"&&(
          <KalshiTab contracts={contracts} simDone={simDone} sim={sim} />
        )}


        {/* ── Q-KALSHI TAB ── */}
        {activeTab==="qkalshi"&&(
          <QKalshiTab />
        )}

        {/* ── HURRICANE TAB ── */}
        {activeTab==="hurricane"&&<HurricaneTab />}

        {/* ── COMPARE TAB ── */}
        {activeTab==="compare"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={card()}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:14}}>ALL SOURCES vs INDUSTRY (2000–2024)</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={COMPARISON} margin={{top:5,right:10,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.dim}/>
                  <XAxis dataKey="year" stroke={C.border2} tick={{fill:C.muted,fontSize:10}} interval={3}/>
                  <YAxis stroke={C.border2} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>`$${v}B`}/>
                  <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border2}`,fontSize:11,fontFamily:"'IBM Plex Mono',monospace"}} formatter={(v,n)=>[`$${v}B`,n]}/>
                  <Legend wrapperStyle={{fontSize:10,color:C.muted}}/>
                  <Line dataKey="industry"   stroke={C.white}    strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Industry"/>
                  <Line dataKey="smart"      stroke={C.teal}     strokeWidth={2}   dot={false} name="Smart Adj"/>
                  <Line dataKey="owid"       stroke={C.sage}     strokeWidth={1.5} dot={false} name="OWID"/>
                  <Line dataKey="emdat"      stroke={C.rose}     strokeWidth={1.2} dot={false} name="EM-DAT"/>
                  <Line dataKey="calibrated" stroke={C.lavender} strokeWidth={1.2} strokeDasharray="3 3" dot={false} name="Calibrated"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={card()}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"1px",marginBottom:14}}>ADJUSTMENT METHODOLOGY</div>
              {[{years:"2000–2001",regime:"Structural Gap",mult:"~3.0×",color:C.rose,desc:"Early EM-DAT had poor coverage of developing-country events."},
                {years:"2002–2012",regime:"Well Calibrated",mult:"1.05×",color:C.sage,desc:"OWID closely tracks industry consensus."},
                {years:"2013–2021",regime:"Mild Correction",mult:"1.15×",color:C.lavender,desc:"Growing gap in uninsured loss estimation."},
                {years:"2022+",regime:"Reporting Lag",mult:"1.05–1.45×",color:C.teal,desc:"Decays ~0.25× per year as events are filed."},
              ].map(r=>(
                <div key={r.years} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.dim}`}}>
                  <div style={{minWidth:80,fontSize:10,color:r.color,fontWeight:600}}>{r.years}</div>
                  <div>
                    <div style={{display:"flex",gap:10,alignItems:"baseline",marginBottom:2}}>
                      <span style={{fontSize:12,color:C.white}}>{r.regime}</span>
                      <span style={{fontSize:11,color:r.color}}>×{r.mult}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{padding:"10px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:10,color:C.dim}}>
        <span>Rhodex · EM-DAT © UCLouvain · OWID © Our World in Data · Gallagher RE · Swiss Re sigma</span>
        <span>COMPOUND POISSON · FEAR MULT {FEAR_MULT}×</span>
      </div>
    </div>
  );
}