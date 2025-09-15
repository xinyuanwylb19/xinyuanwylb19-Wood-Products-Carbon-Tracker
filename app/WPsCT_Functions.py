#------------------------------------------------------------------------------
# Wood Products Carbon Tracker – Functions
# Created on Fri Sep 12 09:43:12 2025                
# author: xinyuan.wei
#------------------------------------------------------------------------------
import math
import pandas as pd
import scipy.integrate as integrate
import matplotlib.pyplot as plt

#------------------------------------------------------------------------------
# Biofuel carbon flux (charcoal + emissions)
def biofuel_CF(years, fuel, efficiency):

    fuel = pd.Series(fuel, dtype=float).reset_index(drop=True)
    charcoal_inflow = pd.Series(index=range(years), dtype=float) 
    emissions = pd.Series(index=range(years), dtype=float)
    
    for i in range(years):
        f = float(fuel.iat[i] if i < len(fuel) else 0.0)
        ch = (1.0 - efficiency) * f
        em = efficiency * f
        charcoal_inflow.iat[i] = ch
        emissions.iat[i] = em
        
    return charcoal_inflow, emissions
#------------------------------------------------------------------------------
# Charcoal carbon flux (pool-size based decay: dr = dc1 + dc2 * ln(stock))
def biochar_CF(years, inflow, dc1, dc2):

    inflow = pd.Series(inflow, dtype=float).reset_index(drop=True)
    stock = pd.Series(index=range(years), dtype=float)
    decay = pd.Series(index=range(years), dtype=float)
    cur_pool = 0.0
    
    for i in range(years):
        cur_pool = cur_pool + float(inflow.iat[i] if i < len(inflow) else 0.0)
        dr = dc1 + dc2 * math.log(max(cur_pool, 1e-12))
        dr = min(1.0, max(0.0, float(dr)))
        d = cur_pool * dr
        cur_pool = cur_pool - d
        stock.iat[i] = cur_pool
        decay.iat[i] = d
        
    return stock, decay

#------------------------------------------------------------------------------
# Disposal model for in-use wood products (Gaussian-like bell curve)
def disposal_rate(t, dp1, dp2, dp3):
    a = dp1 / math.exp(math.sqrt(2 * math.pi))
    b = math.exp((-dp2 * ((t - dp3) ** 2)) / max(dp3, 1e-12))
    dr = a * b
    return max(0.0, float(dr))

def disposal_CF(years, production, dp1, dp2, dp3):

    production = pd.Series(production, dtype=float).reset_index(drop=True)
    inuse = pd.Series(index=range(years), dtype=float)
    dispos = pd.Series(index=range(years), dtype=float)

    def in_use(age):
        val = 1.0 - integrate.quad(
            lambda tt: disposal_rate(tt, dp1, dp2, dp3),
            0.0, float(age)
        )[0]
        return min(1.0, max(0.0, float(val)))

    for i in range(years):
        s = 0.0
        d = 0.0
        for j in range(i + 1):
            c = float(production.iat[j] if j < len(production) else 0.0)
            age = float(i - j + 1)
            s += c * in_use(age)
            d += c * disposal_rate(age, dp1, dp2, dp3)
        inuse.iat[i] = s
        dispos.iat[i] = d

    return inuse, dispos

#------------------------------------------------------------------------------
# Recycled products carbon flux (eecycling rate: rr = rp1 + rp2 * ln(t))
def recycle_CF(years, disposals, rp1, rp2):
    
    disposals = pd.Series(disposals, dtype=float).reset_index(drop=True)
    recycled = pd.Series(index=range(years), dtype=float)
    landfill = pd.Series(index=range(years), dtype=float)

    for i in range(years):
        d = float(disposals.iat[i] if i < len(disposals) else 0.0)
        rr = float(rp1) + float(rp2) * math.log(max(i + 1.0, 1e-12))
        rr = min(1.0, max(0.0, rr))
        r = rr * d
        recycled.iat[i] = r
        landfill.iat[i] = d - r
        
    return recycled, landfill

#------------------------------------------------------------------------------
# Landfill carbon flux (Decay rate: l(t) = log(t) * k1 / (k2 * sqrt(2*pi)))
'''
def landfill_CF(years, landfill_input, k1, k2):
    
    landfill_input = pd.Series(landfill_input, dtype=float).reset_index(drop=True)
    landfill_pool = pd.Series(index=range(years), dtype=float)
    landfill_decayed = pd.Series(index=range(years), dtype=float)

    def rate(tsd):
        return (math.log(tsd) * k1) / (k2 * math.sqrt(2 * math.pi))

    def survive(tsd):
        if tsd >= k2:
            return 0.0
        upper = float(min(tsd, k2))
        fr = abs(integrate.quad(rate, 0.0, upper)[0])
        val = 1.0 - fr
        return min(1.0, max(0.0, val))

    # Pool
    for i in range(years):
        s = 0.0

        if i <= int(k2):
            for j in range(i + 1):
                c = float(landfill_input.iat[j] if j < len(landfill_input) else 0.0)
                upper = float(i + 1 - j)
                fr = abs(integrate.quad(rate, 0.0, upper)[0])
                s += c * (1.0 - fr)
        else:
            for j in range(int(k2)):
                idx = int(i - k2 + j)
                if 0 <= idx < len(landfill_input):
                    c = float(landfill_input.iat[idx])
                    upper = float(k2 - j)
                    fr = abs(integrate.quad(rate, 0.0, upper)[0])
                    s += c * (1.0 - fr)

        landfill_pool.iat[i] = s

    for i in range(years):
        prev = 0.0 if i == 0 else float(landfill_pool.iat[i - 1])
        inc  = float(landfill_input.iat[i] if i < len(landfill_input) else 0.0)
        landfill_decayed.iat[i] = prev + inc - float(landfill_pool.iat[i])

    return landfill_pool, landfill_decayed
'''

def survive(t, k1, k2):
    if k2 <= 0:
        raise ValueError("k2 must be > 0")
    if t <= 0:
        return 1.0
    z = (math.log(t) - k1) / k2
    Phi = 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
    S = 1.0 - Phi
    if S < 0.0: 
        return 0.0
    if S > 1.0: 
        return 1.0
    return S

def landfill_CF(years, landfill_input, k1, k2):
    
    landfill_input = pd.Series(landfill_input, dtype=float).reset_index(drop=True)
    n_in = len(landfill_input)
    print(n_in)
    arr = [float(landfill_input.iat[i]) if i < n_in else 0.0 for i in range(n_in)]

    # Precompute survival for ages 0..years
    S = [survive(a, k1, k2) for a in range(n_in + 1)]

    landfill_pool = [0.0] * n_in
    landfill_decayed = [0.0] * n_in

    for i in range(n_in):
        s = 0.0
        # Cohorts 0..i, age at end of year i is (i+1-j)
        for j in range(i + 1):
            age = i + 1 - j
            s += arr[j] * S[age]
        landfill_pool[i] = s

    prev = 0.0
    for i in range(n_in):
        inc = arr[i]
        dec = (prev + inc) - landfill_pool[i]
        landfill_decayed[i] = 0.0 if dec < 0.0 and dec > -1e-12 else max(0.0, dec)
        prev = landfill_pool[i]

    return landfill_pool, landfill_decayed

#------------------------------------------------------------------------------
# Plot annual production lines for wood products
def products_plot(file, savefile):

    df = pd.read_csv(file)
    x  = df['Year']

    cols = ['Biofuel', 'Biochar', 'Construction', 'Exterior', 'Household',
            'Graphic Paper', 'Other Paper', 'Household Paper']

    # Fixed, readable colors (color-blind friendly where possible) + distinct widths
    color_map = {
        'Biofuel':         'grey',  
        'Biochar':         'black',  
        'Construction':    'brown',  
        'Exterior':        'red',  
        'Household':       'purple',  
        'Graphic Paper':   'blue',  
        'Other Paper':     'lightblue', 
        'Household Paper': 'yellow',  
    }
    width_map = {
        'Biofuel': 3.0,
        'Biochar': 1.0,
        'Construction': 1.0,
        'Exterior': 2.4,
        'Household': 2.6,
        'Graphic Paper': 1.0,
        'Other Paper': 4.0,
        'Household Paper': 1.0,
    }

    plt.figure(figsize=(9, 6))
    for c in cols:
        if c in df.columns:
            plt.plot(x, df[c],
                     label=c,
                     color=color_map.get(c, None),
                     linewidth=width_map.get(c, 2.0))

    plt.xlabel('Year')
    plt.ylabel('Annual production')
    plt.title('Annual production of wood products')
    plt.legend(ncol=2, frameon=True, framealpha=0.8)
    plt.grid(True, linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(savefile, dpi=300)

    plt.show()
    plt.close()

#------------------------------------------------------------------------------
# Plot WPsCT results carbon pool size
def pools_plot(file, savefile):
    df = pd.read_csv(file)
    x  = df['Year']

    # column -> short label
    cols_map = {
        'Biochar_Stock'          : 'Biochar',
        'Construction_InUse'     : 'Construction',
        'Household_InUse'        : 'Household',
        'GraphicPaper_InUse'     : 'GraphicPaper',
        'OtherPaper_InUse'       : 'OtherPaper',
        'HouseholdPaper_InUse'   : 'HouseholdPaper',
        'LF_Stock_Total'         : 'Landfill',
    }

    # readable colors + distinct widths (optional tweakable)
    color_map = {
        'Biochar'        : '#1f77b4',
        'Construction'   : '#2ca02c',
        'Household'      : '#9467bd',
        'GraphicPaper'   : '#8c564b',
        'OtherPaper'     : '#e377c2',
        'HouseholdPaper' : '#7f7f7f',
        'Landfill'       : '#d62728',
    }
    width_map = {
        'Biochar': 3.0, 'Construction': 2.8, 'Household': 2.6,
        'GraphicPaper': 2.4, 'OtherPaper': 2.2,
        'HouseholdPaper': 2.2, 'Landfill': 2.8
    }

    plt.figure(figsize=(9, 6))
    for col, short in cols_map.items():
        if col in df.columns:
            y_TgC = df[col] / 1_000_000_000.0
            plt.plot(x, y_TgC,
                     label=short,
                     color=color_map.get(short, None),
                     linewidth=width_map.get(short, 2.2))

    plt.xlabel('Year')              # x label kept simple
    plt.ylabel('Stock (TgC)')       # converted units
    plt.title('Carbon stocks over time (TgC)')
    plt.legend(ncol=2, frameon=True, framealpha=0.85)
    plt.grid(True, linestyle='--', alpha=0.35)
    plt.tight_layout()
    plt.savefig(savefile, dpi=300)

    plt.show()
    plt.close()
