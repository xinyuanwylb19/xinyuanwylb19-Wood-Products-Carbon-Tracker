# Wood Products Carbon Tracker — Web App

This repository hosts a browser-based version of your Wood Products Carbon Tracker using **PyScript** (Python running in the browser via Pyodide).

## How it works
- Users can:
  - Run the **Maine** or **US** examples. Or upload **Wood Products Data (CSV format)**.
  - Use the **default parameter file** provided in `/data/WPs_Tracker_paras.csv`. Or upload **parameter file (CSV format)**.
- The app computes results, shows preview, and plots results.

## Data & File Formats
- Input data CSV columns should match the examples. 
  `Year,Biofuel,Biochar,Construction,Exterior,Household,Graphic Paper,Other Paper,Household Paper`
- Parameter CSV file must match the default parameter file (see `/data/WPs_Tracker_paras.csv`).
