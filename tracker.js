// Wood Products Carbon Tracker – tracker.js (ES module)
// Drop this next to index.html. It attaches the UI handlers automatically.
// Structure: defaults → helpers → core model → UI wiring.

// ---------------- Parameters (defaults) ----------------
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

// ---------------- Helpers ----------------
const $ = (id) => document.getElementById(id);
const toCSV = (rows) => rows.map(r => r.map(v => String(v)).join(',')).join('\n');
const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj = {};
    head.forEach((h, i) => {
      const val = parts[i] ?? '';
      const num = Number(val);
      obj[h.trim()] = Number.isFinite(num) && /^(?:\d+\.?\d*|\.\d+)$/.test(val) ? num : val;
    });
    return obj;
  });
};

export function makeDefaultParamsCSV(){
  const rows = [["section","key","value"]];
  const push = (section, obj) => Object.entries(obj).forEach(([k, v]) => rows.push([section, k, String(v)]));
  const p = DEFAULT_PARAMS;
  push('bio', p.bio); push('bud', p.bud); push('exu', p.exu); push('hma', p.hma);
  push('pap_newspaper', p.pap_newspaper); push('pap_graphic', p.pap_graphic); push('pap_packing', p.pap_packing); push('pap_household', p.pap_household);
  push('ldf', p.ldf);
  return toCSV(rows);
}

export function paramsFromCSVText(text){
  const override = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  const lines = text.trim().split(/\r?\n/);
  if(!lines.length) return override;
  lines.slice(1).forEach(line => {
    const [section, key, raw] = line.split(',');
    if(!override[section]) return;
    const num = Number(raw);
    override[section][key] = Number.isFinite(num) ? num : raw;
  });
  return override;
}

// Numeric helpers
const integrate = (fn, a, b, steps = 128) => {
  if(!isFinite(a) || !isFinite(b)) return 0;
  const h = (b - a) / steps; let sum = 0;
  for (let k = 0; k <= steps; k++) { const x = a + k * h; const w = (k === 0 || k === steps) ? 0.5 : 1; sum += w * fn(x);} 
  return sum * h;
};
const drGaussian = (dp1, dp2, dp3) => T => (dp1 / Math.exp(Math.sqrt(2 * Math.PI))) * Math.exp((-dp2 * Math.pow((T - dp3), 2)) / dp3);
const drLandfill = (a, b) => T => { if (T <= 1e-6) return 0; return (Math.log(T) * a) / (b * Math.sqrt(2 * Math.PI)); };

function poolAndDisposed(ty, inflow, dr, windowYears = null){
  const P = new Array(ty).fill(0), D = new Array(ty).fill(0);
  for (let i = 0; i < ty; i++){
    let accA = 0, accD = 0; const j0 = windowYears ? Math.max(0, i - Math.floor(windowYears) + 1) : 0;
    for (let j = j0; j <= i; j++){
      const ts = i + 1 - j; const yrC = inflow[j] || 0; const lfr = integrate(dr, 0, ts, 128);
      accA += yrC * (1 - lfr); accD += yrC * dr(ts);
    }
    P[i] = accA; D[i] = accD;
  }
  return { P, D };
}
const recycleSeries = (D, rp1, rp2) => D.map((d, i) => d * Math.max(0, (rp1 || 0) + (rp2 || 0) * Math.log(i + 1)));
function charcoalSeries(ty, fuel, ce, biochar, dc1, dc2){
  const C = [], P = [], D = []; let pool = 0;
  for (let i = 0; i < ty; i++){
    const fChar = (fuel[i] || 0) * ((100 - ce) / 100);
    const yrC = (biochar[i] || 0) + fChar; pool += yrC;
    const dr = dc1 + dc2 * Math.log(Math.max(pool, 1e-9));
    const yrD = pool * dr; pool -= yrD; C.push(yrC); P.push(pool); D.push(yrD);
  }
  return { C, P, D };
}
function landfillSeries(ty, Lpap, Lbud, Lexu, Lhma, params){
  const dPap = drLandfill(params.pap1, params.pap2);
  const dBud = drLandfill(params.bud1, params.bud2);
  const dExu = drLandfill(params.exu1, params.exu2);
  const dHma = drLandfill(params.hma1, params.hma2);
  const comp = (D, dr, win) => poolAndDisposed(ty, D, dr, win);
  const Ppap = comp(Lpap, dPap, params.pap2).P; const Dpap = comp(Lpap, dPap, params.pap2).D;
  const Pbud = comp(Lbud, dBud, params.bud2).P; const Dbud = comp(Lbud, dBud, params.bud2).D;
  const Pexu = comp(Lexu, dExu, params.exu2).P; const Dexu = comp(Lexu, dExu, params.exu2).D;
  const Phma = comp(Lhma, dHma, params.hma2).P; const Dharma = comp(Lhma, dHma, params.hma2).D;
  const P = [], D = [], C = [];
  for (let i = 0; i < ty; i++){ C[i] = (Lpap[i] || 0) + (Lbud[i] || 0) + (Lexu[i] || 0) + (Lhma[i] || 0); P[i] = Ppap[i] + Pbud[i] + Pexu[i] + Phma[i]; D[i] = Dpap[i] + Dbud[i] + Dexu[i] + Dharma[i]; }
  return { C, P, D, components: { Ppap, Pbud, Pexu, Phma, Dpap, Dbud, Dexu, Dharma } };
}

// ---------------- Core model ----------------
export function runModel(inputRows, params){
  const p = params || DEFAULT_PARAMS;
  const Y   = inputRows.map(r => Number(r.Year)); const ty = Y.length;
  const Fuel= inputRows.map(r => Number(r.Fuel||0));
  const Bio = inputRows.map(r => Number(r.Biochar||0));
  const Bud = inputRows.map(r => Number(r.Building||0));
  const Exu = inputRows.map(r => Number(r.Exterior_use||0));
  const Hma = inputRows.map(r => Number(r.Home_application||0));
  const Ppn = inputRows.map(r => Number(r.Paper_Newspaper||0));
  const Ppg = inputRows.map(r => Number(r.Paper_Graphic||0));
  const Ppp = inputRows.map(r => Number(r.Paper_Packing||0));
  const Pph = inputRows.map(r => Number(r.Paper_Household||0));

  // Charcoal/Biochar
  const CC = charcoalSeries(ty, Fuel, p.bio.ce, Bio, p.bio.dc1, p.bio.dc2);

  // Long-lived products
  const PB = poolAndDisposed(ty, Bud, (T)=> (1/Math.exp(Math.sqrt(2*Math.PI))) * p.bud.dp1 * Math.exp((-p.bud.dp2*Math.pow((T-p.bud.dp3),2))/p.bud.dp3), p.bud.dp3);
  const PE = poolAndDisposed(ty, Exu, (T)=> (1/Math.exp(Math.sqrt(2*Math.PI))) * p.exu.dp1 * Math.exp((-p.exu.dp2*Math.pow((T-p.exu.dp3),2))/p.exu.dp3), p.exu.dp3);
  const PH = poolAndDisposed(ty, Hma, (T)=> (1/Math.exp(Math.sqrt(2*Math.PI))) * p.hma.dp1 * Math.exp((-p.hma.dp2*Math.pow((T-p.hma.dp3),2))/p.hma.dp3), p.hma.dp3);

  const RB = recycleSeries(PB.D, p.bud.rp1, p.bud.rp2);
  const RH = recycleSeries(PH.D, p.hma.rp1, p.hma.rp2);
  const LB = PB.D.map((d,i)=>d-(RB[i]||0));
  const LE = PE.D.slice();
  const LH = PH.D.map((d,i)=>d-(RH[i]||0));

  // Paper categories
  const mkPap = (inflow, par) => {
    const dr = (T)=> (1/Math.exp(Math.sqrt(2*Math.PI))) * par.dp1 * Math.exp((-par.dp2*Math.pow((T-par.dp3),2))/par.dp3);
    const P = poolAndDisposed(ty, inflow, dr, par.dp3);
    const R = recycleSeries(P.D, par.rp1||0, par.rp2||0);
    const L = P.D.map((d,i)=>d-(R[i]||0));
    return { P, R, L };
  };
  const PPN = mkPap(Ppn, p.pap_newspaper);
  const PPG = mkPap(Ppg, p.pap_graphic);
  const PPP = mkPap(Ppp, p.pap_packing);
  const PPH = mkPap(Pph, p.pap_household);
  const PaperPool = Array.from({length:ty}, (_,i)=> (PPN.P.P[i]||0)+(PPG.P.P[i]||0)+(PPP.P.P[i]||0)+(PPH.P.P[i]||0));
  const Lpap = Array.from({length:ty}, (_,i)=> (PPN.L[i]||0)+(PPG.L[i]||0)+(PPP.L[i]||0)+(PPH.L[i]||0));

  // Landfill
  const LF = landfillSeries(ty, Lpap, LB, LE, LH, p.ldf);

  // Aggregates
  const rows = [["Year","Charcoal","Building","Exterior_use","Home_application","Paper","Landfill","Total"]];
  for(let i=0;i<ty;i++){
    const v=[Y[i], CC.P[i], PB.P[i], PE.P[i], PH.P[i], PaperPool[i], LF.P[i]]; v.push(v.slice(1).reduce((a,b)=>a+b,0));
    rows.push(v.map(x=> typeof x==='number'? Number(x.toFixed(4)) : x));
  }
  const series = {
    years: Y,
    charcoal: CC.P,
    building: PB.P,
    exterior: PE.P,
    home: PH.P,
    paper: PaperPool,
    landfill: LF.P,
    total: rows.slice(1).map(r=>r[7])
  };
  const S = basicStats(series);
  return { table: rows, series, stats: S };
}

// ---------------- Basic statistics ----------------
export function basicStats(series){
  const s = (arr)=>{
    const a = arr.map(v=>Number(v)||0); const n=a.length; const sum=a.reduce((x,y)=>x+y,0); const mean=sum/n; const min=Math.min(...a); const max=Math.max(...a);
    const sd=Math.sqrt(a.reduce((x,y)=>x+Math.pow(y-mean,2),0)/n);
    return {sum,mean,min,max,sd};
  };
  return {
    Charcoal: s(series.charcoal),
    Building: s(series.building),
    Exterior_use: s(series.exterior),
    Home_application: s(series.home),
    Paper: s(series.paper),
    Landfill: s(series.landfill),
    Total: s(series.total)
  };
}

// ---------------- UI wiring ----------------
function number(v){ return Number(v).toLocaleString(undefined,{maximumFractionDigits:2}); }
let CHART = null;

function drawChart(el, series){
  const ctx = el.getContext('2d'); if(CHART) CHART.destroy();
  CHART = new Chart(ctx, {
    type: 'line',
    data: { labels: series.years, datasets: [
      {label:'Charcoal', data: series.charcoal, borderWidth:2, fill:false},
      {label:'Building', data: series.building, borderWidth:2, fill:false},
      {label:'Exterior use', data: series.exterior, borderWidth:2, fill:false},
      {label:'Home application', data: series.home, borderWidth:2, fill:false},
      {label:'Paper', data: series.paper, borderWidth:2, fill:false},
      {label:'Landfill', data: series.landfill, borderWidth:2, fill:false},
      {label:'Total', data: series.total, borderWidth:3, fill:false}
    ]},
    options: { responsive: true, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#cfe2ff' } } },
      scales: { x: { ticks: { color: '#b9c7e6' } }, y: { ticks: { color: '#b9c7e6' }, grid: { color: 'rgba(255,255,255,.06)' } } }
    }
  });
}

function renderStats(el, S){
  el.innerHTML = Object.entries(S).map(([k,v])=>`
    <div class="item">
      <h3>${k}</h3>
      <div class="v">Total: ${number(v.sum)}</div>
      <div class="muted">Mean: ${number(v.mean)} • Min: ${number(v.min)} • Max: ${number(v.max)} • SD: ${number(v.sd)}</div>
    </div>`).join('');
}

export async function attachUI(){
  const els = {
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

  let PARAMS = DEFAULT_PARAMS; let MODEL=null; let INPUT=null;
  const enable = (b)=> els.btnRun.disabled = !b;

  els.dataFile.addEventListener('change', async (e)=>{
    const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); INPUT=parseCSV(text); enable(true);
  });
  els.paramFile.addEventListener('change', async (e)=>{
    const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); PARAMS = paramsFromCSVText(text); alert('Parameters loaded.');
  });
  els.btnDownloadParams.addEventListener('click', ()=>{
    const blob=new Blob([makeDefaultParamsCSV()],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='parameters_default.csv'; a.click(); URL.revokeObjectURL(url);
  });
  els.btnShowParams.addEventListener('click', ()=>{
    const pretty = JSON.stringify(PARAMS,null,2); const w=window.open(''); w.document.write('<pre>'+pretty+'</pre>');
  });
  els.btnReset.addEventListener('click', ()=> location.reload());
  els.btnRun.addEventListener('click', ()=>{
    if(!INPUT){ alert('Please upload a data CSV first.'); return; }
    MODEL = runModel(INPUT, PARAMS);
    drawChart(els.chart, MODEL.series);
    renderStats(els.stats, MODEL.stats);
    els.btnDownloadResults.disabled=false; els.btnDownloadChart.disabled=false;
  });
  els.btnDownloadResults.addEventListener('click', ()=>{
    if(!MODEL) return; const blob=new Blob([toCSV(MODEL.table)],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='results.csv'; a.click(); URL.revokeObjectURL(url);
  });
  els.btnDownloadChart.addEventListener('click', ()=>{
    if(!CHART) return; const a=document.createElement('a'); a.href=CHART.toBase64Image(); a.download='chart.png'; a.click();
  });
}

// Auto-attach when loaded
attachUI();
