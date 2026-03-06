      // ══════════════════════════════════════════════════════════════════════
      // SAWN PRODUCTS (PPs) CARBON TAB
      // ══════════════════════════════════════════════════════════════════════

      const PPS_WOOD_PROPS = {
        softwood: { density: 420, carbonFraction: 0.50 },
        hardwood: { density: 580, carbonFraction: 0.49 },
        tropical: { density: 680, carbonFraction: 0.48 },
      };

      const PPS_EFFICIENCY_DEFAULTS = {
        'Construction': 0.90, 'Exterior': 0.88, 'Household': 0.85,
        'Graphic Paper': 0.80, 'Household Paper': 0.80, 'Other Paper': 0.82,
      };

      const PPS_TYPE_DESC = {
        lumber:      'Dimensional lumber (2×4, 2×6, glulam beams, etc.): enter thickness, width, length.',
        panel:       'Sheet goods (plywood, OSB, MDF, particleboard): enter thickness, width, length.',
        engineered:  'Structural composite lumber (CLT, LVL, Glulam, I-joist): specify sub-type and cross-section.',
        other:       'Any other solid wood product: enter total serviceable volume directly.',
      };

      let currentPPsType = 'lumber';
      let selectedPPsProduct = null;

      window.setPPsType = function(type) {
        currentPPsType = type;
        document.querySelectorAll('.pps-type-btn').forEach(btn => {
          btn.classList.toggle('selected', btn.dataset.ptype === type);
        });
        ['lumber','panel','engineered','other'].forEach(t => {
          document.getElementById('pps-inputs-' + t).classList.toggle('hidden', t !== type);
        });
        document.getElementById('pps-type-desc').textContent = PPS_TYPE_DESC[type];
        onPPsChange();
      };

      window.syncPPsDefaults = function() {
        const wt = document.getElementById('pps-woodtype').value;
        const props = PPS_WOOD_PROPS[wt];
        document.getElementById('pps-density').value     = props.density;
        document.getElementById('pps-carbon-frac').value = props.carbonFraction;
      };

      window.resetPPsParams = function() {
        syncPPsDefaults();
        onPPsChange();
      };

      window.resetPPsEfficiency = function() {
        const val = selectedPPsProduct && PPS_EFFICIENCY_DEFAULTS[selectedPPsProduct]
                    ? PPS_EFFICIENCY_DEFAULTS[selectedPPsProduct] : 0.90;
        document.getElementById('pps-efficiency').value = val;
        onPPsChange();
      };

      function calcPPsVolume() {
        const t = currentPPsType;
        if (t === 'lumber') {
          const th = parseFloat(document.getElementById('pps-thickness').value) / 1000;
          const w  = parseFloat(document.getElementById('pps-width').value) / 1000;
          const l  = parseFloat(document.getElementById('pps-length').value);
          const q  = parseFloat(document.getElementById('pps-qty').value) || 1;
          if (!th || !w || !l) return null;
          return { vol: th * w * l * q, label: `${document.getElementById('pps-thickness').value}×${document.getElementById('pps-width').value} mm × ${l} m × ${q} pcs` };
        } else if (t === 'panel') {
          const th = parseFloat(document.getElementById('pps-panel-t').value) / 1000;
          const w  = parseFloat(document.getElementById('pps-panel-w').value);
          const l  = parseFloat(document.getElementById('pps-panel-l').value);
          const q  = parseFloat(document.getElementById('pps-panel-q').value) || 1;
          if (!th || !w || !l) return null;
          return { vol: th * w * l * q, label: `${document.getElementById('pps-panel-t').value} mm × ${w}×${l} m × ${q} sheets` };
        } else if (t === 'engineered') {
          const d  = parseFloat(document.getElementById('pps-eng-d').value) / 1000;
          const w  = parseFloat(document.getElementById('pps-eng-w').value) / 1000;
          const l  = parseFloat(document.getElementById('pps-eng-l').value);
          const q  = parseFloat(document.getElementById('pps-eng-q').value) || 1;
          const sub = document.getElementById('pps-eng-sub').value.toUpperCase();
          if (!d || !w || !l) return null;
          return { vol: d * w * l * q, label: `${sub} ${document.getElementById('pps-eng-d').value}×${document.getElementById('pps-eng-w').value} mm × ${l} m × ${q} pcs` };
        } else {
          const vol = parseFloat(document.getElementById('pps-other-vol').value);
          if (!vol) return null;
          return { vol, label: document.getElementById('pps-other-desc').value || 'Custom volume' };
        }
      }

      window.onPPsChange = function() {
        const wt = document.getElementById('pps-woodtype').value;
        const density = parseFloat(document.getElementById('pps-density').value) || PPS_WOOD_PROPS[wt].density;
        const cfrac   = parseFloat(document.getElementById('pps-carbon-frac').value) || PPS_WOOD_PROPS[wt].carbonFraction;
        const eff     = parseFloat(document.getElementById('pps-efficiency').value) || 0.90;
        const vr = calcPPsVolume();
        if (vr && vr.vol > 0) {
          const mass = vr.vol * density;
          const cTotal = mass * cfrac;
          const cProduct = cTotal * eff;
          document.getElementById('pps-estimate').classList.remove('hidden');
          document.getElementById('pps-estimate-display').innerHTML =
            `Product: <b>${vr.label}</b><br>` +
            `Volume: <b>${vr.vol.toFixed(4)} m³</b> &nbsp;|&nbsp; Mass: <b>${mass.toFixed(1)} kg</b><br>` +
            `Total carbon: <b>${cTotal.toFixed(2)} kg C</b> &nbsp;|&nbsp; ` +
            `Serviceable carbon: <b>${cProduct.toFixed(2)} kg C</b> (eff. ${(eff*100).toFixed(0)}%)`;
          // auto-suggest end-use
          if (!selectedPPsProduct) {
            const sug = (currentPPsType === 'panel' || currentPPsType === 'engineered') ? 'Construction' : 'Household';
            selectPPsProduct(sug);
          }
        }
      };

      window.selectPPsProduct = function(name) {
        selectedPPsProduct = name;
        document.querySelectorAll('#pps-product-grid .product-card').forEach(card => {
          card.classList.toggle('selected', card.dataset.product === name);
        });
        const effField = document.getElementById('pps-efficiency');
        if (effField && PPS_EFFICIENCY_DEFAULTS[name]) {
          const cur = parseFloat(effField.value);
          const isDefault = Object.values(PPS_EFFICIENCY_DEFAULTS).some(v => Math.abs(v - cur) < 0.001);
          if (isDefault) effField.value = PPS_EFFICIENCY_DEFAULTS[name];
        }
        onPPsChange();
      };

      function setPPsStatus(msg) { document.getElementById('pps-status').textContent = msg; }

      window.runPPsTracker = async function() {
        if (!pyReady) {
          setPPsStatus('⏳ Initializing Python…');
          await initPy();
          if (!pyReady) { setPPsStatus('❌ Initialization failed.'); return; }
        }
        if (!selectedPPsProduct) { setPPsStatus('Please select an end-use category first.'); return; }

        const wt = document.getElementById('pps-woodtype').value;
        const nYears  = parseInt(document.getElementById('pps-years').value) || 100;
        const density = parseFloat(document.getElementById('pps-density').value) || PPS_WOOD_PROPS[wt].density;
        const cfrac   = parseFloat(document.getElementById('pps-carbon-frac').value) || PPS_WOOD_PROPS[wt].carbonFraction;
        const eff     = parseFloat(document.getElementById('pps-efficiency').value) || 0.90;
        const vr = calcPPsVolume();
        if (!vr || vr.vol <= 0) { setPPsStatus('Please enter valid product dimensions.'); return; }

        const mass       = vr.vol * density;
        const cTotal     = mass * cfrac;
        const carbonKg   = cTotal * eff;   // serviceable carbon entering the product
        setPPsStatus('Running carbon tracker…');

        try {
          pyodide.globals.set('pps_carbon_kg',    carbonKg);
          pyodide.globals.set('pps_product_name', selectedPPsProduct);
          pyodide.globals.set('pps_n_years',      nYears);
          pyodide.globals.set('pps_para_path',    '/data/WPs_Tracker_paras.csv');

          const jsonStr = await pyodide.runPythonAsync(`
import pandas as pd, json, math, sys
sys.path.append('/app')
import WPsCT_Functions as wf

para = pd.read_csv(pps_para_path)
prod = pps_product_name
n    = int(pps_n_years)
C0   = float(pps_carbon_kg)

def get_para(product, variable):
    rows = para.loc[(para['Product'] == product) & (para['Variable'] == variable), 'Parameter']
    return float(rows.values[0]) if len(rows) > 0 else 0.0

production = [C0] + [0.0] * (n - 1)
dp1 = get_para(prod, 'disposal_1')
dp2 = get_para(prod, 'disposal_2')
dp3 = get_para(prod, 'disposal_3')
inuse_raw, _ = wf.disposal_CF(n, production, dp1, dp2, dp3)
inuse_arr = [max(0.0, float(v)) for v in inuse_raw]

landfill_in_raw = []
for i in range(n):
    prev = inuse_arr[i-1] if i > 0 else C0
    landfill_in_raw.append(max(0.0, prev - inuse_arr[i]))

rp1_rows = para.loc[(para['Product'] == prod) & (para['Variable'] == 'recycle_1'), 'Parameter']
if len(rp1_rows) > 0:
    rp1 = float(rp1_rows.values[0]); rp2 = get_para(prod, 'recycle_2')
    rr = [min(1.0, max(0.0, rp1 + rp2 * math.log(max(i+1.0,1e-12)))) for i in range(n)]
    landfill_in = [landfill_in_raw[i] * (1.0 - rr[i]) for i in range(n)]
else:
    landfill_in = landfill_in_raw[:]

lf_map = {
    'Construction':('con_decay1','con_decay2'),'Exterior':('ext_decay1','ext_decay2'),
    'Household':('hou_decay1','hou_decay2'),'Graphic Paper':('pap_decay1','pap_decay2'),
    'Other Paper':('pap_decay1','pap_decay2'),'Household Paper':('pap_decay1','pap_decay2'),
}
k2 = get_para('Landfill', lf_map.get(prod, ('con_decay1','con_decay2'))[1])
decay_rate = math.log(2.0) / max(k2, 0.01)
lf_pool_arr = [max(0.0, sum(landfill_in[j]*math.exp(-decay_rate*(i-j)) for j in range(i+1))) for i in range(n)]

years_arr      = list(range(1, n+1))
total_retained = [max(0.0, inuse_arr[i]+lf_pool_arr[i]) for i in range(n)]
cumul_released = [max(0.0, min(C0, C0-total_retained[i])) for i in range(n)]
out = {'years':years_arr,'inuse':inuse_arr,'lf_pool':lf_pool_arr,
       'total_retained':total_retained,'cumul_released':cumul_released,'C0':C0}
json.dumps(out, allow_nan=False)
          `);

          const res = JSON.parse(jsonStr);
          renderPPsResults(res, cTotal, carbonKg, eff, vr, wt, nYears);
          setPPsStatus(`Done — tracked ${nYears} years for ${selectedPPsProduct} (${vr.label}).`);
        } catch(err) {
          console.error(err);
          setPPsStatus('Run failed. See browser console.');
        }
      };

      function renderPPsResults(res, cTotal, carbonKg, eff, vr, wt, nYears) {
        const finalRetained = res.total_retained[res.total_retained.length-1];
        const finalReleased = res.cumul_released[res.cumul_released.length-1];
        const retPct = (finalRetained/carbonKg*100).toFixed(1);
        const relPct = (finalReleased/carbonKg*100).toFixed(1);
        const effPct = (eff*100).toFixed(0);

        document.getElementById('pps-summary-badges').innerHTML = `
          <div class="flex flex-col items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span class="text-lg font-bold text-gray-700">${cTotal.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Total product carbon</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-teal-50 rounded-xl border border-teal-200">
            <span class="text-lg font-bold text-teal-700">${carbonKg.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Serviceable carbon<br>(${effPct}% efficiency)</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-blue-50 rounded-xl border border-blue-200">
            <span class="text-lg font-bold text-blue-700">${finalRetained.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Retained at year ${nYears}<br>(${retPct}%)</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-red-50 rounded-xl border border-red-200">
            <span class="text-lg font-bold text-red-600">${finalReleased.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Released at year ${nYears}<br>(${relPct}%)</span>
          </div>`;
        document.getElementById('pps-summary-panel').classList.remove('hidden');

        const traces = [
          { x:res.years, y:res.total_retained, mode:'lines', name:'Total Retained',
            line:{color:'#0d9488',width:2.5}, fill:'tozeroy', fillcolor:'rgba(13,148,136,0.08)' },
          { x:res.years, y:res.inuse, mode:'lines', name:'In-use Pool',
            line:{color:'#2563eb',width:2,dash:'dot'} },
          { x:res.years, y:res.lf_pool, mode:'lines', name:'Landfill Pool',
            line:{color:'#9333ea',width:2,dash:'dash'} },
          { x:res.years, y:res.cumul_released, mode:'lines', name:'Cumulative Released',
            line:{color:'#dc2626',width:2}, fill:'tozeroy', fillcolor:'rgba(220,38,38,0.06)' }
        ];
        Plotly.newPlot('pps-plot-area', traces, {
          autosize:true, margin:{l:65,r:20,t:50,b:80},
          legend:{orientation:'h',y:-0.28},
          xaxis:{title:{text:'Years after production',standoff:20}},
          yaxis:{title:{text:'Carbon (kg C)',standoff:12}},
          title:{text:`Sawn Product Carbon — ${selectedPPsProduct} (${wt}, ${vr.vol.toFixed(4)} m³, eff.${effPct}%)`,font:{size:12}},
          hovermode:'x unified'
        }, { responsive:true, displayModeBar:true });

        // Table
        let html = '<table style="border-collapse:collapse;width:100%;font-size:0.78rem"><thead><tr style="background:#f1f5f9">';
        ['Year','In-use (kg C)','Landfill Pool (kg C)','Total Retained (kg C)','Cumul. Released (kg C)'].forEach(h => {
          html += `<th style="border:1px solid #e2e8f0;padding:3px 7px;text-align:right">${h}</th>`;
        });
        html += '</tr></thead><tbody>';
        for (let i=0; i<res.years.length; i++) {
          if (i>=20 && (i+1)%5!==0) continue;
          const bg = i%2===0?'#fff':'#f8fafc';
          html += `<tr style="background:${bg}">`;
          [res.years[i], res.inuse[i].toFixed(3), res.lf_pool[i].toFixed(3),
           res.total_retained[i].toFixed(3), res.cumul_released[i].toFixed(3)].forEach(v => {
            html += `<td style="border:1px solid #e2e8f0;padding:3px 7px;text-align:right">${v}</td>`;
          });
          html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('pps-results-preview').innerHTML = html;

        // ── Download CSV ─────────────────────────────────────────────────────
        let csv = 'Year,InUse_kgC,LandfillPool_kgC,TotalRetained_kgC,CumulReleased_kgC\n';
        for (let i = 0; i < res.years.length; i++) {
          csv += `${res.years[i]},${res.inuse[i].toFixed(4)},${res.lf_pool[i].toFixed(4)},${res.total_retained[i].toFixed(4)},${res.cumul_released[i].toFixed(4)}\n`;
        }
        const blobP = new Blob([csv], { type: 'text/csv' });
        const dlP = document.getElementById('pps-download-link');
        dlP.href = URL.createObjectURL(blobP);
        dlP.classList.remove('hidden');
        setPPsStatus('Done. Carbon storage calculated successfully.');
      }

      window.clearPPs = function clearPPs() {
        document.getElementById('pps-results-preview').innerHTML = '';
        document.getElementById('pps-download-link').classList.add('hidden');
        document.getElementById('pps-estimate').classList.add('hidden');
        Plotly.purge('pps-plot-area');
        setPPsStatus('Cleared. Select end-use category, then click Run.');
      };

      // Init PPs estimate on load
      onPPsChange();

