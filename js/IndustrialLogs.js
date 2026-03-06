      // ══════════════════════════════════════════════════════════════════════
      // LOG CARBON TAB
      // ══════════════════════════════════════════════════════════════════════

      // Wood density (kg/m³) and carbon fraction defaults by type
      const WOOD_PROPS = {
        softwood: { density: 450, carbonFraction: 0.50 },
        hardwood: { density: 600, carbonFraction: 0.48 }
      };

      // Conversion efficiency defaults per product
      const EFFICIENCY_DEFAULTS = {
        'Construction':    0.70,
        'Household':       0.65,
        'Exterior':        0.85, 
        'Graphic Paper':   0.85,
        'Household Paper': 0.90,
        'Other Paper':     0.95,
      };

      window.resetEfficiency = function() {
        const prod = selectedProduct;
        const val  = prod && EFFICIENCY_DEFAULTS[prod] ? EFFICIENCY_DEFAULTS[prod] : 0.70;
        document.getElementById('log-efficiency').value = val;
        onLogInputChange();
      }

      // Reset physical param fields to wood-type defaults
      window.resetPhysicalParams = function() {
        const wt = document.getElementById('log-woodtype').value;
        const props = WOOD_PROPS[wt];
        document.getElementById('log-density').value      = props.density;
        document.getElementById('log-carbon-frac').value  = props.carbonFraction;
        onLogInputChange();
      }

      // When wood type changes, auto-fill density/carbon fraction only if still at a default value
      window.syncPhysicalDefaults = function syncPhysicalDefaults() {
        const wt = document.getElementById('log-woodtype').value;
        const props = WOOD_PROPS[wt];
        const curDensity = parseFloat(document.getElementById('log-density').value);
        const curFrac    = parseFloat(document.getElementById('log-carbon-frac').value);
        // Auto-update if the current value matches the OTHER wood type's default (i.e. user hasn't customised)
        const otherProps = WOOD_PROPS[wt === 'softwood' ? 'hardwood' : 'softwood'];
        if (curDensity === otherProps.density)     document.getElementById('log-density').value     = props.density;
        if (curFrac    === otherProps.carbonFraction) document.getElementById('log-carbon-frac').value = props.carbonFraction;
      }

      // ── Volume method ──────────────────────────────────────────────────────
      let currentVolMethod = 'cylinder';

      const VOL_METHOD_META = {
        cylinder: {
          desc: 'V = π × r² × L — single diameter, overestimates tapered logs.',
          inputs: 'vol-inputs-cylinder'
        },
        huber: {
          desc: 'V = π × r_mid² × L — mid-point diameter only, most commonly used in practice.',
          inputs: 'vol-inputs-huber'
        },
        smalian: {
          desc: 'V = π/2 × (r_butt² + r_tip²) × L — uses both end diameters.',
          inputs: 'vol-inputs-smalian'
        },
        newton: {
          desc: 'V = π/6 × (r_butt² + 4×r_mid² + r_tip²) × L — most accurate, needs 3 measurements.',
          inputs: 'vol-inputs-newton'
        }
      };

      window.setVolMethod = function(method) {
        currentVolMethod = method;
        // Update button styles
        document.querySelectorAll('.vol-method-btn').forEach(btn => {
          const isSelected = btn.dataset.method === method;
          btn.classList.toggle('selected', isSelected);
        });
        // Show/hide input panels
        ['cylinder','huber','smalian','newton'].forEach(m => {
          document.getElementById('vol-inputs-' + m).classList.toggle('hidden', m !== method);
        });
        // Update description
        document.getElementById('vol-method-desc').textContent = VOL_METHOD_META[method].desc;
        onLogInputChange();
      }

      function calcVolume() {
        const pi = Math.PI;
        const toR = d => (parseFloat(d) / 2) / 100; // cm diameter → m radius
        const L = m => parseFloat(document.getElementById('log-length' + m).value) || 0;

        if (currentVolMethod === 'cylinder') {
          const r = toR(document.getElementById('log-diameter').value || 0);
          const l = L('');
          if (!r || !l) return null;
          return { vol: pi * r * r * l, L: l, method: 'Cylinder' };

        } else if (currentVolMethod === 'huber') {
          const r = toR(document.getElementById('log-d-mid').value || 0);
          const l = L('-h');
          if (!r || !l) return null;
          return { vol: pi * r * r * l, L: l, method: 'Huber' };

        } else if (currentVolMethod === 'smalian') {
          const rb = toR(document.getElementById('log-d-butt').value || 0);
          const rt = toR(document.getElementById('log-d-tip').value  || 0);
          const l  = L('-s');
          if (!rb || !l) return null;
          return { vol: (pi / 2) * (rb * rb + rt * rt) * l, L: l, method: 'Smalian' };

        } else if (currentVolMethod === 'newton') {
          const rb = toR(document.getElementById('log-d-butt-n').value || 0);
          const rm = toR(document.getElementById('log-d-mid-n').value  || 0);
          const rt = toR(document.getElementById('log-d-tip-n').value  || 0);
          const l  = L('-n');
          if (!rb || !rm || !l) return null;
          return { vol: (pi / 6) * (rb * rb + 4 * rm * rm + rt * rt) * l, L: l, method: 'Newton' };
        }
        return null;
      }

      // ── Product suggestion (uses first diameter available) ─────────────────
      function suggestProduct(diamCm, woodType) {
        if (woodType === 'softwood') {
          if (diamCm >= 25) return 'Construction';
          if (diamCm >= 15) return 'Exterior';
          return 'Household';
        } else { // hardwood
          if (diamCm >= 30) return 'Construction';
          if (diamCm >= 18) return 'Household';
          if (diamCm >= 10) return 'Exterior';
          return 'Graphic Paper';
        }
      }

      let selectedProduct = null;

      window.onLogInputChange = function onLogInputChange() {
        const wt      = document.getElementById('log-woodtype').value;
        const density = parseFloat(document.getElementById('log-density').value)     || WOOD_PROPS[wt].density;
        const cfrac   = parseFloat(document.getElementById('log-carbon-frac').value) || WOOD_PROPS[wt].carbonFraction;

        const result = calcVolume();
        if (result && result.vol > 0) {
          const { vol, method } = result;
          const mass     = vol * density;
          const carbonKg = mass * cfrac;

          const eff = parseFloat(document.getElementById('log-efficiency')?.value) || 0.70;
          const carbonProduct = carbonKg * eff;
          document.getElementById('log-carbon-estimate').classList.remove('hidden');
          document.getElementById('log-carbon-display').innerHTML =
            `Method: <b>${method}</b> &nbsp;|&nbsp; Volume: <b>${vol.toFixed(3)} m³</b><br>` +
            `Mass: <b>${mass.toFixed(1)} kg</b> (density ${density} kg/m³)<br>` +
            `Log carbon: <b>${carbonKg.toFixed(2)} kg C</b> &nbsp;|&nbsp; <b>${(carbonKg/1000).toFixed(4)} Mg C</b><br>` +
            `Conversion efficiency: <b>${(eff*100).toFixed(0)}%</b> → Product carbon: <b>${carbonProduct.toFixed(2)} kg C</b>`;

          // Auto-suggest product using the first/primary diameter
          let primaryDiam = 0;
          if (currentVolMethod === 'cylinder')  primaryDiam = parseFloat(document.getElementById('log-diameter').value) || 0;
          else if (currentVolMethod === 'huber') primaryDiam = parseFloat(document.getElementById('log-d-mid').value) || 0;
          else if (currentVolMethod === 'smalian') primaryDiam = parseFloat(document.getElementById('log-d-butt').value) || 0;
          else if (currentVolMethod === 'newton')  primaryDiam = parseFloat(document.getElementById('log-d-butt-n').value) || 0;

          if (primaryDiam > 0) {
            const sug = suggestProduct(primaryDiam, wt);
            document.querySelectorAll('.product-card').forEach(card => {
              card.classList.remove('suggested');
              if (card.dataset.product === sug) card.classList.add('suggested');
            });
            document.getElementById('log-suggestion-note').textContent = `💡 Suggested: ${sug} (based on log size & type)`;
            document.getElementById('log-suggestion-note').classList.remove('hidden');
            if (!selectedProduct) selectProduct(sug);
          }
        }
      }

      window.selectProduct = function selectProduct(name) {
        selectedProduct = name;
        document.querySelectorAll('.product-card').forEach(card => {
          card.classList.toggle('selected', card.dataset.product === name);
        });
        // Auto-set efficiency to product default if field is still at a generic default
        const effField = document.getElementById('log-efficiency');
        if (effField && EFFICIENCY_DEFAULTS[name]) {
          // Only auto-fill if value matches one of the known defaults (user hasn't customised)
          const cur = parseFloat(effField.value);
          const isADefault = Object.values(EFFICIENCY_DEFAULTS).some(v => Math.abs(v - cur) < 0.001);
          if (isADefault) effField.value = EFFICIENCY_DEFAULTS[name];
        }
        onLogInputChange();
      }

      function setLogStatus(msg) { document.getElementById('log-status').textContent = msg; }

      window.runLogTracker = async function runLogTracker() {
        if (!pyReady) {
          setLogStatus('⏳ Initializing Python environment, please wait…');
          await initPy();
          if (!pyReady) {
            setLogStatus('❌ Initialization failed. Please check your internet connection and try again.');
            return;
          }
        }
        if (!selectedProduct) { setLogStatus('Please select a product type first.'); return; }

        const wt      = document.getElementById('log-woodtype').value;
        const nYears  = parseInt(document.getElementById('log-years').value) || 100;
        const density = parseFloat(document.getElementById('log-density').value)     || WOOD_PROPS[wt].density;
        const cfrac   = parseFloat(document.getElementById('log-carbon-frac').value) || WOOD_PROPS[wt].carbonFraction;

        const volResult = calcVolume();
        if (!volResult || volResult.vol <= 0) { setLogStatus('Please enter valid log dimensions.'); return; }

        const vol         = volResult.vol;
        const mass        = vol * density;
        const carbonKgLog = mass * cfrac;          // total carbon in the log
        const efficiency  = parseFloat(document.getElementById('log-efficiency').value) || 0.70;
        const carbonKg    = carbonKgLog * efficiency;  // carbon entering the product
        const L           = volResult.L;

        setLogStatus('Running log carbon tracker…');

        try {
          // Build a 1-year production series: carbon enters in year 1, zeros thereafter
          // We pass the carbon as kg C as "production" to disposal_CF
          pyodide.globals.set('log_carbon_kg',    carbonKg);
          pyodide.globals.set('log_product_name', selectedProduct);
          pyodide.globals.set('log_n_years',      nYears);
          pyodide.globals.set('log_para_path',    '/data/WPs_Tracker_paras.csv');

          const jsonStr = await pyodide.runPythonAsync(`
import pandas as pd, json, math, sys
sys.path.append('/app')
import WPsCT_Functions as wf

para = pd.read_csv(log_para_path)
prod = log_product_name
n    = int(log_n_years)
C0   = float(log_carbon_kg)   # carbon entering the product (after efficiency)

def get_para(product, variable):
    rows = para.loc[(para['Product'] == product) & (para['Variable'] == variable), 'Parameter']
    return float(rows.values[0]) if len(rows) > 0 else 0.0

# ── Step 1: In-use pool via disposal_CF ───────────────────────────────────────
production = [C0] + [0.0] * (n - 1)
dp1 = get_para(prod, 'disposal_1')
dp2 = get_para(prod, 'disposal_2')
dp3 = get_para(prod, 'disposal_3')

inuse_raw, _ = wf.disposal_CF(n, production, dp1, dp2, dp3)
inuse_arr = [max(0.0, float(v)) for v in inuse_raw]

# ── Step 2: Landfill inflow = actual decrease in in-use each year ─────────────
# This correctly captures only what truly leaves in-use; once in-use=0, inflow=0
landfill_in_raw = []
for i in range(n):
    prev_inuse = inuse_arr[i-1] if i > 0 else C0
    flow = max(0.0, prev_inuse - inuse_arr[i])
    landfill_in_raw.append(flow)

# ── Step 3: Recycling reduces landfill input ──────────────────────────────────
rp1_rows = para.loc[(para['Product'] == prod) & (para['Variable'] == 'recycle_1'), 'Parameter']
if len(rp1_rows) > 0:
    rp1 = float(rp1_rows.values[0])
    rp2 = get_para(prod, 'recycle_2')
    rr_series = [min(1.0, max(0.0, rp1 + rp2 * math.log(max(i+1.0, 1e-12)))) for i in range(n)]
    landfill_in = [landfill_in_raw[i] * (1.0 - rr_series[i]) for i in range(n)]
else:
    landfill_in = landfill_in_raw[:]

# ── Step 4: Landfill pool — cohort survival with exponential decay ────────────
# Each cohort entering landfill at year j decays with half-life k2.
# At year i, cohort j has survived for (i-j) years: amount = inflow[j] * exp(-ln2/k2*(i-j))
# This guarantees: when inflow stops, pool decays cleanly to zero.
lf_map = {
    'Construction':    ('con_decay1','con_decay2'),
    'Exterior':        ('ext_decay1','ext_decay2'),
    'Household':       ('hou_decay1','hou_decay2'),
    'Graphic Paper':   ('pap_decay1','pap_decay2'),
    'Other Paper':     ('pap_decay1','pap_decay2'),
    'Household Paper': ('pap_decay1','pap_decay2'),
}
lf_keys = lf_map.get(prod, ('con_decay1','con_decay2'))
k2 = get_para('Landfill', lf_keys[1])
decay_rate = math.log(2.0) / max(k2, 0.01)

lf_pool_arr = []
for i in range(n):
    pool = sum(landfill_in[j] * math.exp(-decay_rate * (i - j)) for j in range(i + 1))
    lf_pool_arr.append(max(0.0, pool))

# ── Step 5: Derived series ────────────────────────────────────────────────────
years_arr      = list(range(1, n + 1))
total_retained = [max(0.0, inuse_arr[i] + lf_pool_arr[i]) for i in range(n)]
cumul_released = [max(0.0, min(C0, C0 - total_retained[i])) for i in range(n)]

out = {
    'years':          years_arr,
    'inuse':          inuse_arr,
    'lf_pool':        lf_pool_arr,
    'total_retained': total_retained,
    'cumul_released': cumul_released,
    'C0':             C0,
    'product':        prod,
    'n_years':        n,
    'lf_halflife':    k2,
}
json.dumps(out, allow_nan=False)
          `);

          const res = JSON.parse(jsonStr);
          renderLogResults(res, carbonKgLog, carbonKg, efficiency, vol, volResult.method, wt, nYears);
          setLogStatus(`Done — tracked ${nYears} years for ${selectedProduct} wood product.`);

        } catch(err) {
          console.error(err);
          setLogStatus('Run failed. See browser console for details.');
        }
      }

      function renderLogResults(res, carbonKgLog, carbonKg, efficiency, vol, volMethod, woodType, nYears) {
        const years = res.years;

        // ── Summary badges ──────────────────────────────────────────────────
        const finalRetained  = res.total_retained[res.total_retained.length - 1];
        const finalReleased  = res.cumul_released[res.cumul_released.length - 1];
        const retainedPct    = (finalRetained / carbonKg * 100).toFixed(1);
        const releasedPct    = (finalReleased / carbonKg * 100).toFixed(1);
        const peakInUseYr    = res.inuse.indexOf(Math.max(...res.inuse)) + 1;

        const effPct = (efficiency * 100).toFixed(0);
        const badgesHtml = `
          <div class="flex flex-col items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span class="text-lg font-bold text-gray-700">${carbonKgLog.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Log carbon</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-green-50 rounded-xl border border-green-200">
            <span class="text-lg font-bold text-green-700">${carbonKg.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Product carbon<br>(${effPct}% efficiency)</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-blue-50 rounded-xl border border-blue-200">
            <span class="text-lg font-bold text-blue-700">${finalRetained.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Retained at year ${nYears}<br>(${retainedPct}% of product C)</span>
          </div>
          <div class="flex flex-col items-center p-3 bg-red-50 rounded-xl border border-red-200">
            <span class="text-lg font-bold text-red-600">${finalReleased.toFixed(2)} kg C</span>
            <span class="text-xs text-gray-500 mt-1 text-center">Released at year ${nYears}<br>(${releasedPct}% of product C)</span>
          </div>
        `;
        document.getElementById('log-summary-badges').innerHTML = badgesHtml;
        document.getElementById('log-summary-panel').classList.remove('hidden');

        // ── Chart ───────────────────────────────────────────────────────────
        const traces = [
          {
            x: years, y: res.total_retained,
            mode: 'lines', name: 'Total Retained (In-use + Landfill)',
            line: { color: '#16a34a', width: 2.5 },
            fill: 'tozeroy', fillcolor: 'rgba(22,163,74,0.08)'
          },
          {
            x: years, y: res.inuse,
            mode: 'lines', name: 'In-use Pool',
            line: { color: '#2563eb', width: 2, dash: 'dot' }
          },
          {
            x: years, y: res.lf_pool,
            mode: 'lines', name: 'Landfill Pool',
            line: { color: '#9333ea', width: 2, dash: 'dash' }
          },
          {
            x: years, y: res.cumul_released,
            mode: 'lines', name: 'Cumulative Released to Atmosphere',
            line: { color: '#dc2626', width: 2 },
            fill: 'tozeroy', fillcolor: 'rgba(220,38,38,0.06)'
          }
        ];

        const layout = {
          autosize: true,
          width:  document.getElementById('log-plot-area').clientWidth || 800,
          height: document.getElementById('log-plot-area').clientHeight || 450,
          margin: { l:65, r:20, t:50, b:80 },
          legend: { orientation:'h', y:-0.28 },
          xaxis:  { title: { text: 'Years after harvest', standoff: 20 } },
          yaxis:  { title: { text: 'Carbon (kg C)', standoff: 12 } },
          title:  {
            text: `Log Carbon Tracking — ${selectedProduct} (${woodType}, ${vol.toFixed(3)} m³ ${volMethod}, eff. ${(efficiency*100).toFixed(0)}%)`,
            font: { size: 13 }
          },
          hovermode: 'x unified'
        };

        Plotly.newPlot('log-plot-area', traces, layout, { responsive: true, displayModeBar: true });

        // ── Results table ───────────────────────────────────────────────────
        let html = '<table style="border-collapse:collapse;width:100%;font-size:0.78rem">';
        html += '<thead><tr style="background:#f1f5f9">';
        ['Year','In-use (kg C)','Landfill Pool (kg C)','Total Retained (kg C)','Cumul. Released (kg C)'].forEach(h=>{
          html += `<th style="border:1px solid #e2e8f0;padding:3px 7px;text-align:right">${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Show every year up to 20, then every 5th
        for (let i = 0; i < years.length; i++) {
          if (i >= 20 && (i+1) % 5 !== 0) continue;
          const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
          html += `<tr style="background:${bg}">`;
          [years[i],
           res.inuse[i].toFixed(3),
           res.lf_pool[i].toFixed(3),
           res.total_retained[i].toFixed(3),
           res.cumul_released[i].toFixed(3)
          ].forEach(v => {
            html += `<td style="border:1px solid #e2e8f0;padding:3px 7px;text-align:right">${v}</td>`;
          });
          html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('log-results-preview').innerHTML = html;

        // ── Download CSV ────────────────────────────────────────────────────
        let csv = `Year,InUse_kgC,LandfillPool_kgC,TotalRetained_kgC,CumulReleased_kgC\n# LogCarbon=${carbonKgLog.toFixed(4)} ProductCarbon=${carbonKg.toFixed(4)} Efficiency=${efficiency} Method=${volMethod} Volume=${vol.toFixed(4)}m3 Product=${selectedProduct}\n`;
        for (let i = 0; i < years.length; i++) {
          csv += `${years[i]},${res.inuse[i].toFixed(4)},${res.lf_pool[i].toFixed(4)},${res.total_retained[i].toFixed(4)},${res.cumul_released[i].toFixed(4)}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.getElementById('log-download-link');
        link.href = URL.createObjectURL(blob);
        link.classList.remove('hidden');
      }

      window.clearLogTracker = function clearLogTracker() {
        selectedProduct = null;
        document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('log-summary-panel').classList.add('hidden');
        document.getElementById('log-results-preview').innerHTML = '';
        document.getElementById('log-download-link').classList.add('hidden');
        document.getElementById('log-carbon-estimate').classList.add('hidden');
        document.getElementById('log-suggestion-note').classList.add('hidden');
        Plotly.purge('log-plot-area');
        setLogStatus('Cleared. Select product type and run again.');
      }

      // Initialise estimate display on page load
      onLogInputChange();

