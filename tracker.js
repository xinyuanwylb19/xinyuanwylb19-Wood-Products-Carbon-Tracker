// Wood Products Carbon Tracker – tracker.js (ES module)
// Drop this next to index.html. No build step required.

export const DEFAULT_PARAMS = {
  bio: { ce: 96, dc1: 0.007, dc2: 0.0003 },
  bud: { dp1: 0.133, dp2: 0.028, dp3: 80, rp1: 0.085, rp2: 0.015 },
  exu: { dp1: 0.326, dp2: 0.041, dp3: 25 },
  hma: { dp1: 0.265, dp2: 0.031, dp3: 30, rp1: 0.085, rp2: 0.015 },
  pap_newspaper: { dp1: 3.062, dp2: 0.0, dp3: 2, rp1: 0.225, rp2: 0.027 },
  pap_graphic:   { dp1: 1.006, dp2: 0.0, dp3: 6, rp1: 0.225, rp2: 0.027 },
  pap_packing:   { dp1: 6.036, dp2: 0.0, dp3: 1, rp1: 0.225, rp2: 0.027 },
  pap_household: { dp1: 12.036, dp2: 0.0, dp3: 0.5, rp1: 0.0,  rp2: 0.0 },
  ldf: { bud1: 0.997, bud2: 30, exu1: 1.178, exu2: 20, hma1: 1.329, hma2: 15, pap1: 0.821, pap2: 5 }
};

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const toCSV = (rows) => rows.map(r => r.map(v => String(v)).join(',')).join('\n');
const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const head  = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const parts = line.split(',');
    const obj   = {};
    head.forEach((h,i)=>{
      const raw = (parts[i] ?? '').trim();
      const num = Number(raw);
      obj[h] = raw !== '' && Number.isFinite(num) ? num : raw;
    });
    return obj;
  });
};

export function makeDefaultParamsCSV(){
  const rows = [["section","key","value"]];
  const push = (section, obj) => Object.entries(obj).forEach(([k,v]) => rows.push([section,k,String(v)]));
  const p = DEFAULT_PARAMS;
  push('bio', p.bio); push('bud', p.bud); push('exu', p.exu); push('hma', p.hma);
  push('pap_newspaper', p.pap_newspaper); push('pap_graphic', p.pap_graphic);
  push('pap_packing', p.pap_packing); push('pap_household', p.pap_household);
  push('ldf', p.ldf);
  return toCSV(rows);
}

export function paramsFromCSVText(text){
  const override = structuredClone ? structuredClone(DEFAULT_PARAMS) : JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  const lines = text.trim().split(/\r?\n/);
  for(const line of lines.slice(1)){
    const [section,key,valueRaw=''] = line.split(',');
    if(!override[section]) continue;
    const num = Number(valueRaw);
    override[section][key] = Number.isFinite(num) ? num : valueRaw;
  }
  return override;
}

// ---------- Numeric tools ----------
const integrate=(fn,a,b,steps=128)=>{
  if(!isFinite(a)||!isFinite(b)) return 0;
  const h=(b-a)/steps; let sum=0;
  for(let k=0;k<=steps;k++){ const x=a+k*h; const w=(k===0||k===steps)?0.5:1; sum+=w*fn(x); }
  return sum*h;
};
const drGaussian=(dp1,dp2,dp3)=>T=> (dp1/Math.exp(Math.sqrt(2*Math.PI))) * Math.exp((-dp2*Math.pow((T-dp3),2))/dp3);
const drLandfill=(a,b)=>T=>{ if(T<=1e-6) return 0; return (Math.log(T)*a)/(b*Math.sqrt(2*Math.PI)); };

function poolAndDisposed(ty, inflow, dr, windowYears=null){
  const P=new Array(ty).fill(0), D=new Array(ty).fill(0);
  for(let i=0;i<ty;i++){
    let accA=0, accD=0; const j0 = windowYears? Math.max(0, i - Math.floor(windowYears) + 1) : 0;
    for(let j=j0;j<=i;j++){
      const ts=i+1-j; const yrC=inflow[j]||0; const lfr=integrate(dr,0,ts,128);
      accA += yrC*(1-lfr);
      accD += yrC*dr(ts);
    }
    P[i]=accA; D[i]=accD;
  }
  return {P,D};
}
const recycleSeries=(D, rp1, rp2)=> D.map((d,i)=> d*Math.max(0, (rp1||0)+(rp2||0)*Math.log(i+1)));
function charcoalSeries(ty, fuel, ce, biochar, dc1, dc2){
  const C=[], P=[], D=[]; let pool=0;
  for(let i=0;i<ty;i++){
    const fChar = (fuel[i]||0) * ((100-ce)/100);
    const yrC   = (biochar[i]||0) + fChar; pool += yrC;
    const dr    = dc1 + dc2*Math.log(Math.max(pool,1e-9));
    const yrD   = pool*dr; pool -= yrD; C.push(yrC); P.push(pool); D.push(yrD);
  }
  return {C,P,D};
}
function landfillSeries(ty, Lpap, Lbud, Lexu, Lhma, params){
  const dPap=drLandfill(params.pap1,params.pap2);
  const dBud=drLandfill(params.bud1,params.bud2);
  const dExu=drLandfill(params.exu1,params.exu2);
  const dHma=drLandfill(params.hma1,params.hma2);
  const comp=(D,dr,win)=>poolAndDisposed(ty,D,dr,win);
  const Ppap = comp(Lpap,dPap,params.pap2).P; const Pbud = comp(Lbud,dBud,params.bud2).P;
  const Pexu = comp(Lexu,dExu,params.exu2).P; const Phma = comp(Lhma,dHma,params.hma2).P;
  const Dpap = comp(Lpap,dPap,params.pap2).D; const Dbud = comp(Lbud,dBud,params.bud2).D;
  const Dexu = comp(Lexu,dExu,params.exu2).D; const Dharma = comp(Lhma,dHma,params.hma2).D;
  const P=[], D=[], C=[]; for(let i=0;i<ty;i++){ C[i]=(Lpap[i]||0)+(Lbud[i]||0)+(Lexu[i]||0)+(Lhma[i]||0); P[i]=Ppap[i]+Pbud[i]+Pexu[i]+Phma[i]; D[i]=Dpap[i]+Dbud[i]+Dexu[i]+Dharma[i]; }
  return {C,P,D};
}

// ---------- Core model ----------
export function runModel(inputRows, p=DEFAULT_PARAMS){
  const Y   = inputRows.map(r=>Number(r.Year)); const ty=Y.length;
  const Fuel= inputRows.map(r=>Number(r.Fuel||0));
  const Bio = inputRows.map(r=>Number(r.Biochar||0));
  const Bud = inputRows.map(r=>Number(r.Building||0));
  const Exu = inputRows.map(r=>Number(r.Exterior_use||0));
  const Hma = inputRows.map(r=>Number(r.Home_application||0));
  const Ppn = inputRows.map(r=>Number(r.Paper_Newspaper||0));
  const Ppg = inputRows.map(r=>Number(r.Paper_Graphic||0));
  const Ppp = inputRows.map(r=>Number(r.Paper_Packing||0));
  const Pph = inputRows.map(r=>Number(r.Paper_Household||0));

  const CC = charcoalSeries(ty,Fuel,p.bio.ce,Bio,p.bio.dc1,p.bio.dc2);

  const PB = poolAndDisposed(ty,Bud,drGaussian(p.bud.dp1,p.bud.dp2,p.bud.dp3),p.bud.dp3);
  const PE = poolAndDisposed(ty,Exu,drGaussian(p.exu.dp1,p.exu.dp2,p.exu.dp3),p.exu.dp3);
  const PH = poolAndDisposed(ty,Hma,drGaussian(p.hma.dp1,p.hma.dp2,p.hma.dp3),p.hma.dp3);

  const RB = recycleSeries(PB.D, p.bud.rp1, p.bud.rp2);
  const RH = recycleSeries(PH.D, p.hma.rp1, p.hma.rp2);

  const LB = PB.D.map((d,i)=>d-(RB[i]||0));
  const LE = PE.D.slice();
  const LH = PH.D.map((d,i)=>d-(RH[i]||0));

  const mkPap=(inflow, q)=>{ const dr=drGaussian(q.dp1,q.dp2,q.dp3); const P=poolAndDisposed(ty,inflow,dr,q.dp3); const R=recycleSeries(P.D,q.rp1||0,q.rp2||0); const L=P.D.map((d,i)=>d-(R[i]||0)); return {P,R,L}; };
  const PPN=mkPap(Ppn,p.pap_newspaper), PPG=mkPap(Ppg,p.pap_graphic), PPP=mkPap(Ppp,p.pap_packing), PPH=mkPap(Pph,p.pap_household);
  const PaperPool = Array.from({length:ty},(_,i)=>(PPN.P.P[i]||0)+(PPG.P.P[i]||0)+(PPP.P.P[i]||0)+(PPH.P.P[i]||0));
  const Lpap      = Array.from({length:ty},(_,i)=>(PPN.L[i]||0)+(PPG.L[i]||0)+(PPP.L[i]||0)+(PPH.L[i]||0));

  const LF = landfillSeries(ty, Lpap, LB, LE, LH, p.ldf);

  const rows = [["Year","Charcoal","Building","Exterior_use","Home_application","Paper","Landfill","Total"]];
  for(let i=0;i<ty;i++){
    const v=[Y[i], CC.P[i], PB.P[i], PE.P[i], PH.P[i], PaperPool[i], LF.P[i]];
    v.push(v.slice(1).reduce((a,b)=>a+b,0));
    rows.push(v.map(x=> typeof x==='number'? Number(x.toFixed(4)) : x));
  }
  const series = { years:Y, charcoal:CC.P, building:PB.P, exterior:PE.P, home:PH.P, paper:PaperPool, landfill:LF.P, total:rows.slice(1).map(r=>r[7]) };
  const S = basicStats(series);
  return { table:rows, series, stats:S };
}

// ---------- Basic stats ----------
export function basicStats(series){
  const s=(arr)=>{ const a=arr.map(v=>Number(v)||0); const n=a.length; const sum=a.reduce((x,y)=>x+y,0); const mean=sum/n; const min=Math.min(...a); const max=Math.max(...a); const sd=Math.sqrt(a.reduce((x,y)=>x+Math.pow(y-mean,2),0)/n); return {sum,mean,min,max,sd}; };
  return { Charcoal:s(series.charcoal), Building:s(series.building), Exterior_use:s(series.exterior), Home_application:s(series.home), Paper:s(series.paper), Landfill:s(series.landfill), Total:s(series.total) };
}

// ---------- Theme ----------
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wpct-theme', theme);
  // Also refresh chart grid/label colors on theme change
  if(currentChart) recolorChart(currentChart);
}
function initTheme(){
  const saved = localStorage.getItem('wpct-theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

// ---------- UI ----------
let currentChart = null;

function chartColors(){
  const css = getComputedStyle(document.documentElement);
  return {
    grid: 'rgba(0,0,0,0.06)', // overridden below for dark
    tick: css.getPropertyValue('--muted').trim() || '#666',
    lines: [
      css.getPropertyValue('--c1').trim(),
      css.getPropertyValue('--c2').trim(),
      css.getPropertyValue('--c3').trim(),
      css.getPropertyValue('--c4').trim(),
      css.getPropertyValue('--c5').trim(),
      css.getPropertyValue('--c6').trim(),
      css.getPropertyValue('--c7').trim()
    ]
  };
}
function recolorChart(chart){
  const css = getComputedStyle(document.documentElement);
  const tickColor = css.getPropertyValue('--muted').trim() || '#b9c7e6';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  chart.options.scales.x.ticks.color = tickColor;
  chart.options.scales.y.ticks.color = tickColor;
  chart.options.scales.y.grid.color  = isDark ? 'rgba(255,255,255,.06)' : '#e5e7eb';
  chart.update();
}

function drawChart(canvas, series){
  const ctx = canvas.getContext('2d');
  if(currentChart) currentChart.destroy();
  const c = chartColors();
  const datasets = [
    {label:'Charcoal',        data:series.charcoal, borderWidth:2, borderColor:c.lines[0], fill:false},
    {label:'Building',        data:series.building, borderWidth:2, borderColor:c.lines[1], fill:false},
    {label:'Exterior use',    data:series.exterior, borderWidth:2, borderColor:c.lines[2], fill:false},
    {label:'Home application',data:series.home,     borderWidth:2, borderColor:c.lines[3], fill:false},
    {label:'Paper',           data:series.paper,    borderWidth:2, borderColor:c.lines[4], fill:false},
    {label:'Landfill',        data:series.landfill, borderWidth:2, borderColor:c.lines[5], fill:false},
    {label:'Total',           data:series.total,    borderWidth:3, borderColor:c.lines[6], fill:false},
  ];
  currentChart = new Chart(ctx,{
    type:'line',
    data:{ labels:series.years, datasets },
    options:{ responsive:true, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{ labels:{ color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#666' } } },
      scales:{ x:{ ticks:{ color:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#666' } },
               y:{ ticks:{ color:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#666' },
                   grid:{ color: (document.documentElement.getAttribute('data-theme')==='dark') ? 'rgba(255,255,255,.06)' : '#e5e7eb' } } }
    }
  });
}

function number(v){ return Number(v).toLocaleString(undefined,{maximumFractionDigits:2}); }
function renderStats(el, S){
  el.innerHTML = Object.entries(S).map(([k,v])=>`
    <div class="item">
      <h3>${k}</h3>
      <div class="v">Total: ${number(v.sum)}</div>
      <div class="muted">Mean: ${number(v.mean)} • Min: ${number(v.min)} • Max: ${number(v.max)} • SD: ${number(v.sd)}</div>
    </div>`).join('');
}

export async function attachUI(){
  initTheme();

  const els = {
    themeToggle: $('themeToggle'),
    dataFile: $('dataFile'),
    paramFile: $('paramFile'),
    btnRun: $('btnRun'),
    btnReset: $('btnReset'),
    btnDownloadParams: $('btnDownloadParams'),
    btnShowParams: $('btnShowParams'),
    btnDownloadResults: $('btnDownloadResults'),
    btnDownloadChart: $('btnDownloadChart'),
    stats: $('stats'),
    chart: $('chart'),
  };

  // Theme toggle
  els.themeToggle.addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  let PARAMS = DEFAULT_PARAMS;
  let MODEL=null; let INPUT=null;

  const enable = (b)=> els.btnRun.disabled = !b;

  els.dataFile.addEventListener('change', async (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const text=await f.text(); INPUT=parseCSV(text); enable(true);
  });
  els.paramFile.addEventListener('change', async (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const text=await f.text(); PARAMS = paramsFromCSVText(text); alert('Parameters loaded.');
  });
  els.btnDownloadParams.addEventListener('click', ()=>{
    const blob=new Blob([makeDefaultParamsCSV()],{type:'text/csv'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='parameters_default.csv'; a.click(); URL.revokeObjectURL(url);
  });
  els.btnShowParams.addEventListener('click', ()=>{
    const pretty = JSON.stringify(PARAMS,null,2); const w=window.open(''); w.document.write('<pre>'+pretty+'</pre>');
  });
  els.btnReset.addEventListener('click', ()=> location.reload());

  els.btnRun.addEventListener('click', ()=>{
    if(!INPUT){ alert('Please select a data CSV first.'); return; }
    MODEL = runModel(INPUT, PARAMS);
    drawChart(els.chart, MODEL.series);
    renderStats(els.stats, MODEL.stats);
    els.btnDownloadResults.disabled=false; els.btnDownloadChart.disabled=false;
  });

  els.btnDownloadResults.addEventListener('click', ()=>{
    if(!MODEL) return; const blob=new Blob([toCSV(MODEL.table)],{type:'text/csv'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='results.csv'; a.click(); URL.revokeObjectURL(url);
  });
  els.btnDownloadChart.addEventListener('click', ()=>{
    if(!currentChart) return; const a=document.createElement('a');
    a.href=currentChart.toBase64Image(); a.download='chart.png'; a.click();
  });

  // Re-apply chart styles if theme changes elsewhere
  window.addEventListener('storage', (e)=>{ if(e.key==='wpct-theme' && currentChart) recolorChart(currentChart); });
}

// Auto-attach
attachUI();

// (optional) export a default API for reuse/tests
export default { DEFAULT_PARAMS, runModel, basicStats, makeDefaultParamsCSV, paramsFromCSVText, attachUI };
