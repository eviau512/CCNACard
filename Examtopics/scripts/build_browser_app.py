# -*- coding: utf-8 -*-
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_ASSETS = 'CCNA-App/app/src/main/assets'
OUTPUT_HTML = 'Examtopics/output/CCNA_Interactive_App.html'

print("Reading source assets...")

with open(os.path.join(BASE_ASSETS, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

with open(os.path.join(BASE_ASSETS, 'app.css'), 'r', encoding='utf-8') as f:
    app_css = f.read()

with open(os.path.join(BASE_ASSETS, 'ios_simulator.css'), 'r', encoding='utf-8') as f:
    sim_css = f.read()

with open(os.path.join(BASE_ASSETS, 'ios_simulator.js'), 'r', encoding='utf-8') as f:
    sim_js = f.read()

with open(os.path.join(BASE_ASSETS, 'app.js'), 'r', encoding='utf-8') as f:
    app_js = f.read()

with open(os.path.join(BASE_ASSETS, 'data/ccna_cards_data.js'), 'r', encoding='utf-8') as f:
    data_js = f.read()

# Desktop responsive enhancements for PC browser
desktop_css = """
/* Desktop / PC Browser Responsive Enhancements */
@media (min-width: 900px) {
  :root {
    --safe-top: 60px;
  }
  main {
    max-width: 1080px !important;
    padding: 24px !important;
  }
  .card {
    padding: 28px !important;
    border-radius: var(--radius-lg) !important;
  }
  .card-prompt {
    font-size: 1.15rem !important;
    line-height: 1.7 !important;
  }
  /* Simulator Terminal Enlarged for Desktop Monitor */
  .ios-sim-container {
    margin: 18px 0 !important;
    border-radius: 12px !important;
  }
  .ios-sim-screen {
    min-height: 420px !important;
    max-height: 600px !important;
    font-size: 15px !important;
    line-height: 1.55 !important;
  }
  .ios-prompt-line {
    font-size: 15px !important;
  }
  .ios-input {
    font-size: 15px !important;
  }
  /* Exhibit images desktop scaling */
  .exhibit-img {
    max-height: 520px !important;
  }
}

/* Quick Lab Mode Pill in Header */
.lab-shortcut-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: var(--transition);
}
.lab-shortcut-btn:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}
"""

# Replace external CSS with inlined CSS
css_inlined = f"<style>\n{app_css}\n{sim_css}\n{desktop_css}\n</style>"
html = html.replace('<link rel="stylesheet" href="app.css">', css_inlined)
html = html.replace('<link rel="stylesheet" href="ios_simulator.css">', '')

# Add Lab Shortcut button to header if suitable
lab_btn_html = """
      <button class="lab-shortcut-btn" id="headerLabBtn" onclick="jumpToType('sim')" title="Filter to 37 Hands-on Lab Questions">
        <span>🛠️ Lab Sims (37)</span>
      </button>
"""
if '<div class="header-right">' in html:
    html = html.replace('<div class="header-right">', f'<div class="header-right">\n{lab_btn_html}')

# Replace script tags with inlined script tags
scripts_inlined = f"""
  <script>
{data_js}
  </script>
  <script>
{sim_js}
  </script>
  <script>
{app_js}
  </script>
"""

html = html.replace('<script src="data/ccna_cards_data.js"></script>', '')
html = html.replace('<script src="ios_simulator.js"></script>', '')
html = html.replace('<script src="app.js"></script>', scripts_inlined)

print(f"Writing single-file HTML to {OUTPUT_HTML}...")
with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
    f.write(html)

file_size = os.path.getsize(OUTPUT_HTML)
print(f"Success! Generated {OUTPUT_HTML} ({file_size / (1024*1024):.2f} MB)")
