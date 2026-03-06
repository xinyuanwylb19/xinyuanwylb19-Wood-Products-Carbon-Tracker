      // ── Tab switching (also defined early in <head> for safety) ───────────
      window.switchTab = function(name, btn) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        btn.classList.add('active');
      }

      // ── Shared Pyodide state ───────────────────────────────────────────────
      const statusEl   = document.getElementById('status');
      const progressEl = document.getElementById('progress');
      function setStatus(msg)  { statusEl.textContent   = msg; }
      function setProgress(msg){ progressEl.textContent = msg; }

      function toggleInputs(){
        document.getElementById('file-data').disabled  = !document.getElementById('rb-upload-data').checked;
        document.getElementById('file-paras').disabled = !document.getElementById('rb-upload-para').checked;
      }
      ['rb-me','rb-us','rb-upload-data','rb-default-para','rb-upload-para'].forEach(id=>{
        document.getElementById(id).addEventListener('change', toggleInputs);
      });
      toggleInputs();

      let pyodide  = null;
      let pyReady  = false;

      function enableRunButtons(enable){
        ['btn-run','btn-plot-data','btn-plot-storage'].forEach(id=>{
          document.getElementById(id).disabled = !enable;
        });
      }

      function b64text(id){ return atob(document.getElementById(id).textContent.trim()); }
      function b64bytes(id){
        const s = atob(document.getElementById(id).textContent.trim());
        const arr = new Uint8Array(s.length);
        for (let i=0;i<s.length;i++) arr[i] = s.charCodeAt(i);
        return arr;
      }

      async function initPy(){
        try{
          setStatus('Loading Python…');
          pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/' });
          setProgress('Loading packages (pandas, numpy)…');
          await pyodide.loadPackage(['pandas','numpy']);
          setProgress('Writing embedded modules & data…');
          pyodide.FS.mkdirTree('/app'); pyodide.FS.mkdirTree('/data'); pyodide.FS.mkdirTree('/tmp');
          pyodide.FS.writeFile('/app/WPsCT_Main.py',      new TextEncoder().encode(b64text('emb-main')));
          pyodide.FS.writeFile('/app/WPsCT_Functions.py', new TextEncoder().encode(b64text('emb-funcs')));
          pyodide.FS.writeFile('/data/Example_ME.csv',    b64bytes('emb-me'));
          pyodide.FS.writeFile('/data/Example_US.csv',    b64bytes('emb-us'));
          pyodide.FS.writeFile('/data/WPs_Tracker_paras.csv', b64bytes('emb-paras'));
          pyodide.runPython("import sys, os; os.makedirs('/app',exist_ok=True); sys.path.append('/app') if '/app' not in sys.path else None");
          pyReady = true;
          enableRunButtons(true);
          setProgress('');
          setStatus('Tracker ready.');
        }catch(err){ console.error(err); setStatus('Initialization failed. See console.'); }
      }

      // ── Units helpers ──────────────────────────────────────────────────────
      function getInputUnit(){ return document.getElementById('u-lbs').checked?'lbs':document.getElementById('u-kg').checked?'kg':document.getElementById('u-mt').checked?'mt':document.getElementById('u-tgc').checked?'tgc':'kg'; }
      function getPlotUnit(){ return document.getElementById('p-kg').checked?'kg':'tgc'; }
      function toKg(arr,inUnit){ const f=(inUnit==='lbs')?0.45359237:(inUnit==='kg')?1:(inUnit==='mt')?1e9:1e9; return arr.map(v=>(v==null?0:Number(v))*f); }
      function fromKg(arrKg,p){ return (p==='kg')?arrKg:arrKg.map(v=>v/1e9); }
      function unitLabel(p,isC=false){ return (p==='kg')?(isC?'kg C':'kg'):'Tg C (MMTC)'; }

      async function getUploadedFileBytes(inputId){
        const inp = document.getElementById(inputId);
        if (!inp||!inp.files||inp.files.length===0) return [null,null];
        const file=inp.files[0]; const buf=await file.arrayBuffer();
        return [file.name, new Uint8Array(buf)];
      }

      function dataChoice(){ return document.getElementById('rb-me').checked?'example_me':document.getElementById('rb-us').checked?'example_us':'upload'; }
      function paraChoice(){ return document.getElementById('rb-default-para').checked?'default':'upload'; }

      async function resolveDataPath(){
        const ch=dataChoice();
        if(ch==='example_me') return '/data/Example_ME.csv';
        if(ch==='example_us') return '/data/Example_US.csv';
        const [name,bytes]=await getUploadedFileBytes('file-data');
        if(!name) throw new Error('Please choose a data file to upload.');
        const p='/tmp/'+name; pyodide.FS.writeFile(p,bytes); return p;
      }
      async function resolveParaPath(){
        const ch=paraChoice();
        if(ch==='default') return '/data/WPs_Tracker_paras.csv';
        const [name,bytes]=await getUploadedFileBytes('file-paras');
        if(!name) throw new Error('Please choose a parameter file to upload.');
        const p='/tmp/'+name; pyodide.FS.writeFile(p,bytes); return p;
      }

      // ── HWP Tab: run / plot ────────────────────────────────────────────────
      async function runTracker(){
        if(!pyReady){ setStatus('Please click "Initialize Tracker" first.'); return; }
        try{
          setStatus('Running tracker…');
          const dataPath=await resolveDataPath();
          const parasPath=await resolveParaPath();
          const outCsv='/tmp/WPsCT_Results.csv';
          pyodide.globals.set('data_path',dataPath);
          pyodide.globals.set('paras_path',parasPath);
          pyodide.globals.set('out_csv',outCsv);
          await pyodide.runPythonAsync(`
import importlib, pandas as pd
WPsCT_Main = importlib.import_module('WPsCT_Main')
WPsCT_Main.tracker(data_path, paras_path, out_csv)
df = pd.read_csv(out_csv)
html_preview = df.head(40).to_html(index=False)
          `);
          document.getElementById('results-preview').innerHTML = pyodide.globals.get('html_preview');
          const bytes=pyodide.FS.readFile('/tmp/WPsCT_Results.csv');
          const blob=new Blob([bytes],{type:'text/csv'});
          document.getElementById('download-link').href=URL.createObjectURL(blob);
          document.getElementById('download-link').classList.remove('hidden');
          setStatus('Done.');
        }catch(err){ console.error(err); setStatus('Run failed. See console.'); }
      }

      function plotlySize(div){ const el=document.getElementById(div); return {w:el.clientWidth||820,h:el.clientHeight||380}; }

      // Shared colour palette for consistent product colours across both plots
      const HWP_COLORS = {
        'Biofuel':        '#f97316',
        'Biochar':        '#78350f',
        'Construction':   '#1d4ed8',
        'Exterior':       '#0891b2',
        'Household':      '#7c3aed',
        'Graphic Paper':  '#059669',
        'Other Paper':    '#16a34a',
        'Household Paper':'#65a30d',
        'GraphicPaper':   '#059669',
        'OtherPaper':     '#16a34a',
        'HouseholdPaper': '#65a30d',
        'Landfill':       '#9ca3af',
      };

      function hwpBaseLayout(extraLayout){
        return Object.assign({
          autosize: true,
          margin: {l:65, r:25, t:35, b:90},
          paper_bgcolor: '#f9fafb',
          plot_bgcolor:  '#ffffff',
          font: {family: 'Inter, system-ui, sans-serif', size: 12, color: '#374151'},
          legend: {
            orientation: 'h',
            y: -0.28,
            x: 0,
            font: {size: 11},
            bgcolor: 'rgba(0,0,0,0)',
          },
          xaxis: {
            title: {text: 'Year', standoff: 12, font:{size:12}},
            showgrid: true, gridcolor: '#f3f4f6', gridwidth: 1,
            zeroline: false,
            linecolor: '#e5e7eb', linewidth: 1,
            tickfont: {size: 11},
          },
          hovermode: 'x unified',
          hoverlabel: {bgcolor:'#1e293b', font:{color:'#f8fafc', size:11}, bordercolor:'#334155'},
        }, extraLayout||{});
      }

      function displayPlot(divId, traces, extraLayout){
        Plotly.newPlot(divId, traces, hwpBaseLayout(extraLayout),
          {responsive:true, displayModeBar:true,
           modeBarButtonsToRemove:['select2d','lasso2d','autoScale2d'],
           displaylogo:false});
      }

      async function plotData(){
        if(!pyReady){ setStatus('Please click "Initialize Python" first.'); return; }
        try{
          setStatus('Loading input data…');
          const inUnit=getInputUnit(); const pUnit=getPlotUnit();
          const dataPath=await resolveDataPath();
          pyodide.globals.set('data_path',dataPath);
          const jsonStr=await pyodide.runPythonAsync(`
import pandas as pd, json, numpy as np
df = pd.read_csv(data_path)
df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
df = df[df['Year'].notna()].copy()
cols = ['Biofuel','Biochar','Construction','Exterior','Household','Graphic Paper','Other Paper','Household Paper']
out = { 'Year': df['Year'].astype(float).tolist() }
for c in cols:
    if c in df.columns:
        y = pd.to_numeric(df[c], errors='coerce').fillna(0.0)
        out[c] = y.astype(float).tolist()
json.dumps(out, allow_nan=False)
          `);
          const o=JSON.parse(jsonStr);
          const years=o["Year"]||[];
          const seriesOrder=['Construction','Exterior','Household','Graphic Paper','Other Paper','Household Paper','Biochar','Biofuel'];
          const traces=[];
          for(const name of seriesOrder){
            if(o[name]){
              const ykg=toKg(o[name],inUnit); const y=fromKg(ykg,pUnit);
              traces.push({
                x:years, y, mode:'lines', name,
                line:{color:HWP_COLORS[name]||'#6b7280', width:2},
                hovertemplate:'%{y:.3f}<extra>'+name+'</extra>',
              });
            }
          }
          displayPlot('plot-data-area', traces, {
            yaxis:{title:{text:'Annual production ('+unitLabel(pUnit,false)+')', standoff:12, font:{size:12}},
                   showgrid:true, gridcolor:'#f3f4f6', zeroline:false, tickfont:{size:11}},
          });
          setStatus('Input data plotted successfully.');
        }catch(err){ console.error(err); setStatus('Plot failed — see console for details.'); }
      }

      async function plotStorage(){
        if(!pyReady){ setStatus('Please click "Initialize Python" first.'); return; }
        try{
          setStatus('Running model and preparing storage plot…');
          const pUnit=getPlotUnit();
          const outCsv='/tmp/WPsCT_Results.csv';
          try{ pyodide.FS.stat(outCsv); }catch(e){ await runTracker(); }
          pyodide.globals.set('out_csv',outCsv);
          const jsonStr=await pyodide.runPythonAsync(`
import pandas as pd, json, numpy as np
df = pd.read_csv(out_csv)
df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
df = df[df['Year'].notna()].copy()
cols_map = [
  ('Construction_InUse','Construction'),('Exterior_InUse','Exterior'),
  ('Household_InUse','Household'),('GraphicPaper_InUse','GraphicPaper'),
  ('OtherPaper_InUse','OtherPaper'),('HouseholdPaper_InUse','HouseholdPaper'),
  ('Biochar_Stock','Biochar'),('LF_Stock_Total','Landfill'),
]
out = { 'Year': df['Year'].astype(float).tolist(), 'series': {}, 'last': {} }
for col, short in cols_map:
    if col in df.columns:
        y = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
        out['series'][short] = y.astype(float).tolist()
        out['last'][short] = float(y.iloc[-1])
json.dumps(out, allow_nan=False)
          `);
          const o=JSON.parse(jsonStr);
          const years=o["Year"]||[];
          const s=o["series"]||{};
          const last=o["last"]||{};
          const order=['Construction','Exterior','Household','GraphicPaper','OtherPaper','HouseholdPaper','Biochar','Landfill'];
          const displayNames={'GraphicPaper':'Graphic Paper','OtherPaper':'Other Paper','HouseholdPaper':'Household Paper'};
          const traces=[];
          for(const name of order){
            if(s[name]){
              const y=fromKg(s[name],pUnit);
              const label=displayNames[name]||name;
              traces.push({
                x:years, y,
                mode:'lines', name:label,
                fill: name==='Landfill' ? 'tozeroy' : 'none',
                fillcolor: name==='Landfill' ? 'rgba(156,163,175,0.15)' : undefined,
                line:{color:HWP_COLORS[name]||'#6b7280', width: name==='Landfill'?1.5:2,
                      dash: name==='Landfill'?'dot':'solid'},
                hovertemplate:'%{y:.4f}<extra>'+label+'</extra>',
              });
            }
          }
          displayPlot('plot-storage-area', traces, {
            yaxis:{title:{text:'Carbon stock ('+unitLabel(pUnit,true)+')', standoff:12, font:{size:12}},
                   showgrid:true, gridcolor:'#f3f4f6', zeroline:false, tickfont:{size:11}},
          });
          // Summary badges
          const panel=document.getElementById('hwp-summary-panel');
          const badges=document.getElementById('hwp-summary-badges');
          if(panel && badges){
            const inUsePools=['Construction','Exterior','Household','GraphicPaper','OtherPaper','HouseholdPaper'];
            const totalInUse=fromKg([inUsePools.reduce((a,k)=>a+(last[k]||0),0)],pUnit)[0];
            const lf=fromKg([last['Landfill']||0],pUnit)[0];
            const bc=fromKg([last['Biochar']||0],pUnit)[0];
            const total=fromKg([Object.values(last).reduce((a,v)=>a+v,0)],pUnit)[0];
            const ul=unitLabel(pUnit,true);
            const yr=years[years.length-1]||'';
            badges.innerHTML=[
              ['Total Stock', total.toFixed(3)+' '+ul, '#4f46e5','#eef2ff'],
              ['In-use Products', totalInUse.toFixed(3)+' '+ul, '#059669','#ecfdf5'],
              ['Landfill Pool', lf.toFixed(3)+' '+ul, '#6b7280','#f9fafb'],
              ['Biochar Pool', bc.toFixed(3)+' '+ul, '#78350f','#fef3c7'],
            ].map(([label,val,color,bg])=>
              `<div class="rounded-xl p-3 text-center" style="background:${bg}">
                <p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:${color}">${label}</p>
                <p class="text-lg font-bold" style="color:${color}">${val}</p>
                <p class="text-xs text-gray-400">Year ${yr}</p>
              </div>`
            ).join('');
            panel.classList.remove('hidden');
          }
          setStatus('Carbon storage plotted successfully.');
        }catch(err){ console.error(err); setStatus('Plot failed — see console for details.'); }
      }

      function clearAll(){
        document.getElementById('results-preview').innerHTML='';
        document.getElementById('download-link').classList.add('hidden');
        const panel=document.getElementById('hwp-summary-panel');
        if(panel) panel.classList.add('hidden');
        Plotly.purge('plot-data-area'); Plotly.purge('plot-storage-area');
        setStatus('Cleared. Click "Initialize Python" to begin.');
      }

      document.getElementById('btn-init').addEventListener('click', initPy);
      document.getElementById('btn-run').addEventListener('click', runTracker);
      document.getElementById('btn-plot-data').addEventListener('click', plotData);
      document.getElementById('btn-plot-storage').addEventListener('click', plotStorage);
      document.getElementById('btn-clear').addEventListener('click', clearAll);


