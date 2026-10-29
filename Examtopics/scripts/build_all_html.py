import json, os, sys

def generate_html(json_file_path, output_html_path, title_suffix, storage_suffix):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        questions_data = json.load(f)

    json_payload = json.dumps(questions_data, ensure_ascii=False)
    q_count = len(questions_data)
    first_id = questions_data[0]['id']
    last_id = questions_data[-1]['id']

    html_content = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>ExamTopics CCNA 200-301 - {title_suffix}</title>
  <style>
    :root {{
      --bg-body: #f4f6f9;
      --bg-card: #ffffff;
      --bg-header: #ffffff;
      --bg-secondary: #f1f3f4;
      --bg-tertiary: #f8f9fa;
      --border-color: #e2e8f0;
      --border-card: #e2e8f0;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --primary: #1a73e8;
      --primary-hover: #1557b0;
      --primary-light: #e8f0fe;
      --success: #1e8e3e;
      --success-light: #e6f4ea;
      --danger: #d93025;
      --danger-light: #fce8e6;
      --warning: #f9ab00;
      --warning-light: #fef7e0;
      --card-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.1);
      --card-shadow-hover: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06);
      --radius: 12px;
      --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }}

    [data-theme="dark"] {{
      --bg-body: #0b0f19;
      --bg-card: #151d2e;
      --bg-header: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #192338;
      --border-color: #27354a;
      --border-card: #222f42;
      --text-primary: #f8fafc;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --primary-light: rgba(56, 189, 248, 0.14);
      --success: #34d399;
      --success-light: rgba(52, 211, 153, 0.14);
      --danger: #f87171;
      --danger-light: rgba(248, 113, 113, 0.14);
      --warning: #fbbf24;
      --warning-light: rgba(251, 191, 36, 0.14);
      --card-shadow: 0 1px 4px rgba(0,0,0,0.3);
      --card-shadow-hover: 0 6px 16px rgba(0,0,0,0.4);
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-body);
      color: var(--text-primary);
      line-height: 1.6;
      padding-bottom: 90px;
      transition: background-color 0.25s ease, color 0.25s ease;
    }}

    header {{
      background: var(--bg-header);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }}

    .header-inner {{
      max-width: 900px;
      margin: 0 auto;
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }}

    .brand {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .brand-logo {{
      background: linear-gradient(135deg, #1a73e8, #0ea5e9);
      color: white;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.5px;
      padding: 6px 10px;
      border-radius: 6px;
      text-transform: uppercase;
    }}

    .brand-title {{
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary);
    }}

    .brand-subtitle {{
      font-size: 12px;
      color: var(--text-muted);
    }}

    .header-actions {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: var(--transition);
      min-height: 38px;
    }}

    .btn-primary {{
      background: var(--primary);
      color: #0b0f19;
      font-weight: 700;
    }}
    .btn-primary:hover {{
      background: var(--primary-hover);
    }}

    [data-theme="light"] .btn-primary {{
      color: white;
    }}

    .btn-outline {{
      background: var(--bg-card);
      border-color: var(--border-color);
      color: var(--text-primary);
    }}
    .btn-outline:hover {{
      background: var(--bg-secondary);
      border-color: var(--primary);
    }}

    .btn-theme {{
      padding: 6px 10px;
      font-size: 15px;
      border-radius: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      cursor: pointer;
      line-height: 1;
      transition: var(--transition);
    }}
    .btn-theme:hover {{
      transform: scale(1.05);
      border-color: var(--primary);
    }}

    .btn-sm {{
      padding: 6px 10px;
      font-size: 13px;
      min-height: 32px;
    }}

    .stat-bar {{
      background: var(--bg-header);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 16px;
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }}
    .stat-bar-inner {{
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }}

    .filter-group {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }}

    .filter-chip {{
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      border: 1px solid var(--border-color);
      transition: var(--transition);
      user-select: none;
    }}
    .filter-chip:hover {{
      background: var(--bg-tertiary);
      border-color: var(--primary);
    }}
    .filter-chip.active {{
      background: var(--primary-light);
      color: var(--primary);
      border-color: var(--primary);
      font-weight: 600;
    }}

    .score-summary {{
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 13px;
      color: var(--text-secondary);
    }}
    .score-badge {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--bg-secondary);
      font-weight: 600;
    }}
    .score-badge.correct {{
      background: var(--success-light);
      color: var(--success);
      border: 1px solid rgba(52, 211, 153, 0.3);
    }}
    .score-badge.wrong {{
      background: var(--danger-light);
      color: var(--danger);
      border: 1px solid rgba(248, 113, 113, 0.3);
    }}

    main {{
      max-width: 900px;
      margin: 20px auto;
      padding: 0 16px;
    }}

    .pagination-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      padding: 10px 16px;
      border-radius: var(--radius);
      box-shadow: var(--card-shadow);
      margin-bottom: 20px;
      flex-wrap: wrap;
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }}

    .page-info {{
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
    }}

    .jump-box {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .q-card {{
      background: var(--bg-card);
      border-radius: var(--radius);
      box-shadow: var(--card-shadow);
      border: 1px solid var(--border-card);
      padding: 24px;
      margin-bottom: 24px;
      transition: var(--transition);
      position: relative;
    }}
    .q-card:hover {{
      box-shadow: var(--card-shadow-hover);
      border-color: var(--primary);
    }}

    .q-card.is-correct {{
      border-color: var(--success) !important;
    }}
    .q-card.is-wrong {{
      border-color: var(--danger) !important;
    }}

    .q-header {{
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }}

    .q-meta {{
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }}

    .q-number {{
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
    }}

    .q-tag {{
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }}
    .q-tag.multi {{
      background: var(--warning-light);
      color: var(--warning);
      border-color: var(--warning);
    }}
    .q-tag.drag {{
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
      border-color: #a855f7;
    }}

    .btn-bookmark {{
      background: none;
      border: none;
      cursor: pointer;
      font-size: 20px;
      color: var(--text-muted);
      transition: var(--transition);
      padding: 4px;
      line-height: 1;
    }}
    .btn-bookmark:hover {{
      transform: scale(1.15);
      color: var(--warning);
    }}
    .btn-bookmark.active {{
      color: var(--warning);
    }}

    .q-prompt {{
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 18px;
      line-height: 1.6;
      word-break: break-word;
    }}

    .q-exhibit {{
      margin: 16px 0 20px 0;
      text-align: center;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      position: relative;
    }}

    .exhibit-badge {{
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .q-exhibit img {{
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      display: block;
      margin: 0 auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      cursor: zoom-in;
      transition: transform 0.2s ease;
    }}
    .q-exhibit img:hover {{
      transform: scale(1.01);
    }}

    .zoom-hint {{
      font-size: 11px;
      color: #64748b;
      margin-top: 6px;
    }}

    .drag-hint-box {{
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--bg-secondary);
      border-left: 3px solid var(--primary);
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }}

    .q-options {{
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }}

    .option-item {{
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1.5px solid var(--border-color);
      background: var(--bg-card);
      cursor: pointer;
      transition: var(--transition);
      user-select: none;
    }}
    .option-item:hover {{
      border-color: var(--primary);
      background: var(--bg-secondary);
    }}
    .option-item.selected {{
      border-color: var(--primary);
      background: var(--primary-light);
    }}

    .option-item.state-correct {{
      border-color: var(--success) !important;
      background: var(--success-light) !important;
    }}
    .option-item.state-wrong {{
      border-color: var(--danger) !important;
      background: var(--danger-light) !important;
    }}

    .opt-indicator {{
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
      transition: var(--transition);
      border: 1px solid var(--border-color);
    }}
    .option-item.selected .opt-indicator {{
      background: var(--primary);
      color: #0b0f19;
      border-color: var(--primary);
      font-weight: 800;
    }}
    .option-item.state-correct .opt-indicator {{
      background: var(--success);
      color: #0b0f19;
      border-color: var(--success);
      font-weight: 800;
    }}
    .option-item.state-wrong .opt-indicator {{
      background: var(--danger);
      color: white;
      border-color: var(--danger);
      font-weight: 800;
    }}

    .opt-text {{
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.5;
      flex: 1;
      word-break: break-word;
    }}

    .q-actions {{
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 14px;
      border-top: 1px solid var(--border-color);
    }}

    .action-left, .action-right {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .btn-reveal {{
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }}
    .btn-reveal:hover {{
      background: var(--bg-tertiary);
      border-color: var(--primary);
    }}
    .btn-reveal.active {{
      background: var(--border-color);
      color: var(--text-primary);
    }}

    .answer-box {{
      display: none;
      margin-top: 16px;
      padding: 16px;
      border-radius: 8px;
      background: var(--bg-secondary);
      border-left: 4px solid var(--primary);
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
      animation: fadeIn 0.25s ease-in-out;
    }}
    .answer-box.visible {{
      display: block;
    }}

    @keyframes fadeIn {{
      from {{ opacity: 0; transform: translateY(-4px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}

    .ans-title-row {{
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }}

    .ans-badge {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--success);
      color: #0b0f19;
      font-size: 14px;
      font-weight: 800;
    }}

    [data-theme="light"] .ans-badge {{
      color: white;
    }}

    .explanation-text {{
      font-size: 14.5px;
      color: var(--text-secondary);
      line-height: 1.65;
      white-space: pre-line;
      word-break: break-word;
    }}

    .modal-overlay {{
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.65);
      z-index: 200;
      backdrop-filter: blur(3px);
      align-items: center;
      justify-content: center;
      padding: 16px;
    }}
    .modal-overlay.active {{
      display: flex;
    }}

    .modal-content {{
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      color: var(--text-primary);
      border-radius: 14px;
      max-width: 600px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      padding: 20px;
    }}

    .modal-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color);
    }}
    .modal-title {{
      font-size: 18px;
      font-weight: 700;
    }}
    .btn-close {{
      background: none;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: var(--text-muted);
      line-height: 1;
    }}

    .grid-legend {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 12px;
      color: var(--text-secondary);
    }}
    .legend-item {{
      display: flex;
      align-items: center;
      gap: 5px;
    }}
    .legend-dot {{
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }}

    .q-matrix {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
      gap: 8px;
    }}
    .q-matrix-cell {{
      height: 42px;
      border-radius: 6px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: var(--transition);
      border: 1px solid var(--border-color);
      position: relative;
    }}
    .q-matrix-cell:hover {{
      transform: translateY(-2px);
      border-color: var(--primary);
    }}
    .q-matrix-cell.correct {{
      background: var(--success);
      color: #0b0f19;
      border-color: var(--success);
      font-weight: 700;
    }}
    .q-matrix-cell.wrong {{
      background: var(--danger);
      color: white;
      border-color: var(--danger);
      font-weight: 700;
    }}
    .q-matrix-cell.bookmarked::after {{
      content: '★';
      position: absolute;
      top: 1px;
      right: 2px;
      font-size: 9px;
      color: var(--warning);
    }}

    .lightbox-modal {{
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 300;
      align-items: center;
      justify-content: center;
      padding: 16px;
      cursor: zoom-out;
    }}
    .lightbox-modal.active {{
      display: flex;
    }}
    .lightbox-img {{
      max-width: 95%;
      max-height: 90vh;
      border-radius: 6px;
      background: #ffffff;
      padding: 8px;
      box-shadow: 0 5px 25px rgba(0,0,0,0.8);
    }}

    .toast {{
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 400;
      transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
      pointer-events: none;
    }}
    .toast.show {{
      transform: translateX(-50%) translateY(0);
    }}

    @media (max-width: 640px) {{
      .header-inner {{
        padding: 10px 12px;
      }}
      .brand-title {{
        font-size: 15px;
      }}
      main {{
        margin: 12px auto;
        padding: 0 10px;
      }}
      .q-card {{
        padding: 16px;
        margin-bottom: 16px;
        border-radius: 10px;
      }}
      .q-prompt {{
        font-size: 15px;
      }}
      .option-item {{
        padding: 10px 12px;
      }}
      .opt-text {{
        font-size: 14px;
      }}
      .pagination-bar {{
        padding: 8px 12px;
      }}
      .pagination-bar .page-info {{
        width: 100%;
        text-align: center;
        order: -1;
      }}
    }}
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <div class="brand">
        <div class="brand-logo">ET</div>
        <div>
          <div class="brand-title">CCNA 200-301 Practice Engine</div>
          <div class="brand-subtitle">{title_suffix} (Q{first_id} - Q{last_id})</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-theme" id="theme-toggle" onclick="toggleTheme()" title="Toggle Dark / Light Mode">🌙</button>
        <button class="btn btn-outline btn-sm" onclick="openMatrixModal()" title="Question Matrix">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Matrix
        </button>
        <button class="btn btn-outline btn-sm" onclick="exportUserData()" title="Export Practice Records">Export</button>
        <button class="btn btn-outline btn-sm" onclick="importUserData()" title="Import Practice Records">Import</button>
      </div>
    </div>
  </header>

  <div class="stat-bar">
    <div class="stat-bar-inner">
      <div class="filter-group">
        <div class="filter-chip active" id="filter-all" onclick="setFilter('all')">All (<span id="count-all">0</span>)</div>
        <div class="filter-chip" id="filter-unanswered" onclick="setFilter('unanswered')">Unanswered (<span id="count-unanswered">0</span>)</div>
        <div class="filter-chip" id="filter-wrong" onclick="setFilter('wrong')">Incorrect (<span id="count-wrong">0</span>)</div>
        <div class="filter-chip" id="filter-bookmarked" onclick="setFilter('bookmarked')">Bookmarked (<span id="count-bookmarked">0</span>)</div>
      </div>
      <div class="score-summary">
        <div>Completed: <strong id="stat-completed">0</strong>/<span id="stat-total">0</span></div>
        <div class="score-badge correct">✓ <span id="stat-correct">0</span></div>
        <div class="score-badge wrong">✗ <span id="stat-wrong">0</span></div>
        <div>Accuracy: <strong id="stat-acc">0%</strong></div>
      </div>
    </div>
  </div>

  <main>
    <div class="pagination-bar" id="top-pagination">
      <button class="btn btn-outline btn-sm" id="btn-prev-top" onclick="prevPage()">« Previous Page</button>
      <div class="page-info" id="page-info-top">Page 1</div>
      <div class="jump-box">
        <button class="btn btn-primary btn-sm" id="btn-next-top" onclick="nextPage()">Next Page »</button>
      </div>
    </div>

    <div id="questions-container"></div>

    <div class="pagination-bar" id="bottom-pagination">
      <button class="btn btn-outline btn-sm" id="btn-prev-bottom" onclick="prevPage()">« Previous Page</button>
      <div class="page-info" id="page-info-bottom">Page 1</div>
      <button class="btn btn-primary btn-sm" id="btn-next-bottom" onclick="nextPage()">Next Page »</button>
    </div>
  </main>

  <div class="modal-overlay" id="matrix-modal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Question Navigator ({q_count} Questions)</div>
        <button class="btn-close" onclick="closeMatrixModal()">×</button>
      </div>
      <div class="grid-legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--border-color);"></div> Unanswered</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--success);"></div> Correct</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--danger);"></div> Incorrect</div>
        <div class="legend-item"><span style="color:var(--warning); font-size:14px;">★</span> Bookmarked</div>
      </div>
      <div class="q-matrix" id="matrix-grid"></div>
      <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: rgba(248,113,113,0.3);" onclick="resetAllProgress()">Reset Practice Records</button>
        <button class="btn btn-primary btn-sm" onclick="closeMatrixModal()">Close</button>
      </div>
    </div>
  </div>

  <div class="lightbox-modal" id="lightbox" onclick="closeLightbox()">
    <img src="" class="lightbox-img" id="lightbox-img" alt="Enlarged Exhibit">
  </div>

  <div class="toast" id="toast">Message</div>
  <input type="file" id="import-file" style="display:none;" accept=".json" onchange="handleImportFile(event)">

  <script id="exam-data" type="application/json">
    {json_payload}
  </script>

  <script>
    const PAGE_SIZE = 5;
    const STORAGE_KEY = 'examtopics_ccna_records_{storage_suffix}';
    const THEME_KEY = 'examtopics_theme_preference';

    let allQuestions = [];
    let filteredQuestions = [];
    let currentPage = 1;
    let activeFilter = 'all';

    let userRecords = {{
      answers: {{}},
      submitted: {{}},
      correct: {{}},
      revealed: {{}},
      bookmarks: {{}}
    }};

    function initTheme() {{
      const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
      applyTheme(savedTheme);
    }}

    function toggleTheme() {{
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem(THEME_KEY, nextTheme);
    }}

    function applyTheme(theme) {{
      document.documentElement.setAttribute('data-theme', theme);
      const btn = document.getElementById('theme-toggle');
      if (btn) {{
        btn.textContent = theme === 'dark' ? '🌙' : '☀️';
        btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
      }}
    }}

    function loadRecords() {{
      try {{
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {{
          const parsed = JSON.parse(raw);
          userRecords = Object.assign(userRecords, parsed);
        }}
      }} catch (e) {{
        console.warn('LocalStorage unavailable:', e);
      }}
    }}

    function saveRecords() {{
      try {{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecords));
      }} catch (e) {{
        console.warn('Unable to save LocalStorage:', e);
      }}
      updateStats();
    }}

    window.addEventListener('DOMContentLoaded', () => {{
      initTheme();
      const dataEl = document.getElementById('exam-data');
      if (dataEl) {{
        try {{
          allQuestions = JSON.parse(dataEl.textContent);
        }} catch(e) {{
          console.error("Failed to parse embedded exam data", e);
        }}
      }}
      loadRecords();
      applyFilter();
      updateStats();
    }});

    function setFilter(type) {{
      activeFilter = type;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const chip = document.getElementById('filter-' + type);
      if (chip) chip.classList.add('active');
      currentPage = 1;
      applyFilter();
    }}

    function applyFilter() {{
      if (activeFilter === 'all') {{
        filteredQuestions = allQuestions.slice();
      }} else if (activeFilter === 'unanswered') {{
        filteredQuestions = allQuestions.filter(q => !userRecords.submitted[q.id]);
      }} else if (activeFilter === 'wrong') {{
        filteredQuestions = allQuestions.filter(q => userRecords.submitted[q.id] && !userRecords.correct[q.id]);
      }} else if (activeFilter === 'bookmarked') {{
        filteredQuestions = allQuestions.filter(q => !!userRecords.bookmarks[q.id]);
      }}
      renderPage();
    }}

    function renderPage() {{
      const container = document.getElementById('questions-container');
      container.innerHTML = '';

      const totalItems = filteredQuestions.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const pageText = `Page ${{currentPage}} of ${{totalPages}} (${{totalItems}} questions)`;
      document.getElementById('page-info-top').textContent = pageText;
      document.getElementById('page-info-bottom').textContent = pageText;

      document.getElementById('btn-prev-top').disabled = (currentPage === 1);
      document.getElementById('btn-prev-bottom').disabled = (currentPage === 1);
      document.getElementById('btn-next-top').disabled = (currentPage === totalPages);
      document.getElementById('btn-next-bottom').disabled = (currentPage === totalPages);

      if (totalItems === 0) {{
        container.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-card); color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
            <div style="font-size: 16px; font-weight: 600;">No questions found in this filter</div>
            <div style="font-size: 13px; margin-top: 4px;">Select "All" to browse all questions.</div>
          </div>
        `;
        return;
      }}

      const startIdx = (currentPage - 1) * PAGE_SIZE;
      const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
      const pageQuestions = filteredQuestions.slice(startIdx, endIdx);

      pageQuestions.forEach(q => {{
        const card = createQuestionCard(q);
        container.appendChild(card);
      }});

      window.scrollTo({{ top: 0, behavior: 'smooth' }});
    }}

    function prevPage() {{
      if (currentPage > 1) {{
        currentPage--;
        renderPage();
      }}
    }}
    function nextPage() {{
      const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);
      if (currentPage < totalPages) {{
        currentPage++;
        renderPage();
      }}
    }}

    function createQuestionCard(q) {{
      const isDrag = q.type === 'Drag and Drop' || q.type === 'Simulation / Lab' || !q.options || q.options.length === 0;
      const isMulti = q.type === 'Multiple Choice' || (q.answer && q.answer.length > 1);
      const isSubmitted = !!userRecords.submitted[q.id];
      const isCorrect = !!userRecords.correct[q.id];
      const isRevealed = !!userRecords.revealed[q.id];
      const isBookmarked = !!userRecords.bookmarks[q.id];
      const selectedOpts = userRecords.answers[q.id] || [];

      const card = document.createElement('div');
      card.className = 'q-card';
      card.id = `q-card-${{q.id}}`;
      if (isSubmitted && !isDrag) {{
        card.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
      }} else if (isSubmitted && isDrag) {{
        card.classList.add('is-correct');
      }}

      // Exhibit Problem Diagram
      let exhibitHtml = '';
      if (q.image) {{
        exhibitHtml = `
          <div class="q-exhibit">
            <div class="exhibit-badge">${{isDrag ? 'Drag & Drop Exhibit / Topology' : 'Exhibit Diagram'}}</div>
            <img src="${{q.image}}" alt="Exhibit for Question ${{q.id}}" onclick="openLightbox('${{q.image}}')">
            <div class="zoom-hint">Tap / Click diagram to enlarge</div>
          </div>
        `;
      }}

      // Options or Drag & Drop Hint
      let optionsHtml = '';
      if (q.options && q.options.length > 0) {{
        optionsHtml = '<div class="q-options">';
        q.options.forEach(opt => {{
          const isSelected = selectedOpts.includes(opt.label);
          let stateClass = '';
          if (isSubmitted) {{
            const isCorrectOption = q.answer.includes(opt.label);
            if (isCorrectOption) {{
              stateClass = 'state-correct';
            }} else if (isSelected) {{
              stateClass = 'state-wrong';
            }}
          }}

          optionsHtml += `
            <div class="option-item ${{isSelected ? 'selected' : ''}} ${{stateClass}}"
                 onclick="toggleOption(${{q.id}}, '${{opt.label}}', ${{isMulti}})">
              <div class="opt-indicator">${{opt.label}}</div>
              <div class="opt-text">${{opt.text}}</div>
            </div>
          `;
        }});
        optionsHtml += '</div>';
      }} else if (isDrag) {{
        optionsHtml = `
          <div class="drag-hint-box">
            💡 <strong>${{q.type}} Question:</strong> Review the diagram and prompt requirements above. Click <strong>Reveal Answer</strong> below to inspect the verified placement and configuration solution.
          </div>
        `;
      }}

      // Solution Diagram (for Drag and Drop)
      let solutionImgHtml = '';
      if (q.answer_image) {{
        solutionImgHtml = `
          <div class="q-exhibit" style="margin-top: 14px; background: #ffffff;">
            <div class="exhibit-badge">Verified Solution Diagram</div>
            <img src="${{q.answer_image}}" alt="Solution Diagram" onclick="openLightbox('${{q.answer_image}}')">
            <div class="zoom-hint">Tap / Click to enlarge solution</div>
          </div>
        `;
      }}

      const answerStr = q.answer ? q.answer.join(', ') : 'Refer to Solution';
      const answerBoxHtml = `
        <div class="answer-box ${{isRevealed ? 'visible' : ''}}" id="ans-box-${{q.id}}">
          <div class="ans-title-row">
            <span class="ans-badge">Correct Answer: ${{answerStr}}</span>
          </div>
          ${{solutionImgHtml}}
          <div class="explanation-text" style="margin-top: 12px;">${{q.explanation || 'No detailed explanation provided.'}}</div>
        </div>
      `;

      // Badge style
      let typeBadgeClass = '';
      if (isDrag) typeBadgeClass = 'drag';
      else if (isMulti) typeBadgeClass = 'multi';

      card.innerHTML = `
        <div class="q-header">
          <div class="q-meta">
            <span class="q-number">Question #${{q.id}}</span>
            <span class="q-tag">${{q.qid || 'CCNA'}}</span>
            <span class="q-tag ${{typeBadgeClass}}">${{q.type}}</span>
          </div>
          <button class="btn-bookmark ${{isBookmarked ? 'active' : ''}}" onclick="toggleBookmark(${{q.id}})" title="Bookmark Question">
            ★
          </button>
        </div>
        <div class="q-prompt">${{q.prompt}}</div>
        ${{exhibitHtml}}
        ${{optionsHtml}}
        <div class="q-actions">
          <div class="action-left">
            <button class="btn btn-reveal btn-sm ${{isRevealed ? 'active' : ''}}" id="btn-reveal-${{q.id}}" onclick="toggleReveal(${{q.id}})">
              ${{isRevealed ? 'Hide Answer' : 'Reveal Answer'}}
            </button>
          </div>
          <div class="action-right">
            <button class="btn btn-check btn-sm" onclick="checkAnswer(${{q.id}})">
              ${{isDrag ? 'Mark Completed' : 'Check Answer'}}
            </button>
          </div>
        </div>
        ${{answerBoxHtml}}
      `;

      return card;
    }}

    function toggleOption(qId, label, isMulti) {{
      if (userRecords.submitted[qId]) {{
        userRecords.submitted[qId] = false;
        delete userRecords.correct[qId];
      }}

      let current = userRecords.answers[qId] || [];
      if (isMulti) {{
        if (current.includes(label)) {{
          current = current.filter(x => x !== label);
        }} else {{
          current.push(label);
        }}
      }} else {{
        current = [label];
      }}

      userRecords.answers[qId] = current;
      saveRecords();

      const card = document.getElementById(`q-card-${{qId}}`);
      if (card) {{
        card.classList.remove('is-correct', 'is-wrong');
        const items = card.querySelectorAll('.option-item');
        const qObj = allQuestions.find(x => x.id === qId);
        if (qObj) {{
          items.forEach((item, idx) => {{
            const opt = qObj.options[idx];
            item.classList.remove('state-correct', 'state-wrong');
            if (current.includes(opt.label)) {{
              item.classList.add('selected');
            }} else {{
              item.classList.remove('selected');
            }}
          }});
        }}
      }}
    }}

    function checkAnswer(qId) {{
      const q = allQuestions.find(x => x.id === qId);
      if (!q) return;

      const isDrag = q.type === 'Drag and Drop' || q.type === 'Simulation / Lab' || !q.options || q.options.length === 0;

      if (isDrag) {{
        userRecords.submitted[qId] = true;
        userRecords.correct[qId] = true;
        userRecords.revealed[qId] = true;
        saveRecords();

        const card = document.getElementById(`q-card-${{qId}}`);
        if (card) {{
          card.classList.add('is-correct');
          const ansBox = document.getElementById(`ans-box-${{qId}}`);
          if (ansBox) ansBox.classList.add('visible');
          const btnReveal = document.getElementById(`btn-reveal-${{qId}}`);
          if (btnReveal) {{
            btnReveal.textContent = 'Hide Answer';
            btnReveal.classList.add('active');
          }}
        }}
        showToast('✓ Marked as reviewed and completed!');
        return;
      }}

      const userSel = userRecords.answers[qId] || [];
      if (userSel.length === 0) {{
        showToast('Please select an option before checking answer.');
        return;
      }}

      const correctSet = new Set(q.answer);
      const userSet = new Set(userSel);
      const isCorrect = (correctSet.size === userSet.size) && [...correctSet].every(x => userSet.has(x));

      userRecords.submitted[qId] = true;
      userRecords.correct[qId] = isCorrect;
      userRecords.revealed[qId] = true;

      saveRecords();

      const card = document.getElementById(`q-card-${{qId}}`);
      if (card) {{
        card.classList.remove('is-correct', 'is-wrong');
        card.classList.add(isCorrect ? 'is-correct' : 'is-wrong');

        const items = card.querySelectorAll('.option-item');
        items.forEach((item, idx) => {{
          const opt = q.options[idx];
          item.classList.remove('state-correct', 'state-wrong');
          if (q.answer.includes(opt.label)) {{
            item.classList.add('state-correct');
          }} else if (userSel.includes(opt.label)) {{
            item.classList.add('state-wrong');
          }}
        }});

        const ansBox = document.getElementById(`ans-box-${{qId}}`);
        if (ansBox) ansBox.classList.add('visible');

        const btnReveal = document.getElementById(`btn-reveal-${{qId}}`);
        if (btnReveal) {{
          btnReveal.textContent = 'Hide Answer';
          btnReveal.classList.add('active');
        }}
      }}

      showToast(isCorrect ? '✓ Correct! Great job!' : '✗ Incorrect. Review the explanation below.');
    }}

    function toggleReveal(qId) {{
      const isRev = !userRecords.revealed[qId];
      userRecords.revealed[qId] = isRev;
      saveRecords();

      const ansBox = document.getElementById(`ans-box-${{qId}}`);
      const btn = document.getElementById(`btn-reveal-${{qId}}`);
      if (ansBox) {{
        if (isRev) ansBox.classList.add('visible');
        else ansBox.classList.remove('visible');
      }}
      if (btn) {{
        btn.textContent = isRev ? 'Hide Answer' : 'Reveal Answer';
        if (isRev) btn.classList.add('active');
        else btn.classList.remove('active');
      }}
    }}

    function toggleBookmark(qId) {{
      const isBm = !userRecords.bookmarks[qId];
      userRecords.bookmarks[qId] = isBm;
      saveRecords();

      const card = document.getElementById(`q-card-${{qId}}`);
      if (card) {{
        const btn = card.querySelector('.btn-bookmark');
        if (btn) {{
          if (isBm) btn.classList.add('active');
          else btn.classList.remove('active');
        }}
      }}
      showToast(isBm ? '★ Question bookmarked' : '☆ Bookmark removed');
    }}

    function updateStats() {{
      const total = allQuestions.length;
      let completed = 0;
      let correct = 0;
      let wrong = 0;
      let bookmarked = 0;

      allQuestions.forEach(q => {{
        if (userRecords.submitted[q.id]) {{
          completed++;
          if (userRecords.correct[q.id]) correct++;
          else wrong++;
        }}
        if (userRecords.bookmarks[q.id]) bookmarked++;
      }});

      const unanswered = total - completed;
      const acc = completed > 0 ? Math.round((correct / completed) * 100) : 0;

      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-completed').textContent = completed;
      document.getElementById('stat-correct').textContent = correct;
      document.getElementById('stat-wrong').textContent = wrong;
      document.getElementById('stat-acc').textContent = acc + '%';

      document.getElementById('count-all').textContent = total;
      document.getElementById('count-unanswered').textContent = unanswered;
      document.getElementById('count-wrong').textContent = wrong;
      document.getElementById('count-bookmarked').textContent = bookmarked;
    }}

    function openMatrixModal() {{
      const grid = document.getElementById('matrix-grid');
      grid.innerHTML = '';

      allQuestions.forEach(q => {{
        const cell = document.createElement('div');
        cell.className = 'q-matrix-cell';
        cell.textContent = q.id;

        if (userRecords.submitted[q.id]) {{
          cell.classList.add(userRecords.correct[q.id] ? 'correct' : 'wrong');
        }}
        if (userRecords.bookmarks[q.id]) {{
          cell.classList.add('bookmarked');
        }}

        cell.onclick = () => {{
          closeMatrixModal();
          jumpToQuestion(q.id);
        }};

        grid.appendChild(cell);
      }});

      document.getElementById('matrix-modal').classList.add('active');
    }}

    function closeMatrixModal() {{
      document.getElementById('matrix-modal').classList.remove('active');
    }}

    function jumpToQuestion(qId) {{
      if (activeFilter !== 'all') {{
        setFilter('all');
      }}

      const targetIdx = allQuestions.findIndex(q => q.id === qId);
      if (targetIdx !== -1) {{
        currentPage = Math.floor(targetIdx / PAGE_SIZE) + 1;
        renderPage();
        setTimeout(() => {{
          const card = document.getElementById(`q-card-${{qId}}`);
          if (card) {{
            card.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
            card.style.outline = '2px solid var(--primary)';
            setTimeout(() => card.style.outline = 'none', 1500);
          }}
        }}, 150);
      }}
    }}

    function resetAllProgress() {{
      if (confirm('Are you sure you want to clear all practice records and bookmarks for this section?')) {{
        userRecords = {{ answers: {{}}, submitted: {{}}, correct: {{}}, revealed: {{}}, bookmarks: {{}} }};
        saveRecords();
        closeMatrixModal();
        applyFilter();
        showToast('All practice records have been reset.');
      }}
    }}

    function exportUserData() {{
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userRecords, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `CCNA_ExamTopics_Progress_{storage_suffix}_${{new Date().toISOString().slice(0,10)}}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Progress exported to JSON file.');
    }}

    function importUserData() {{
      document.getElementById('import-file').click();
    }}

    function handleImportFile(event) {{
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {{
        try {{
          const imported = JSON.parse(e.target.result);
          if (imported && typeof imported === 'object') {{
            userRecords = Object.assign(userRecords, imported);
            saveRecords();
            applyFilter();
            showToast('Practice records successfully restored!');
          }}
        }} catch(err) {{
          alert('Invalid JSON file format.');
        }}
      }};
      reader.readAsText(file);
    }}

    function openLightbox(src) {{
      const lb = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      img.src = src;
      lb.classList.add('active');
    }}
    function closeLightbox() {{
      document.getElementById('lightbox').classList.remove('active');
    }}

    let toastTimeout;
    function showToast(msg) {{
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
    }}
  </script>
</body>
</html>
"""

    with open(output_html_path, 'w', encoding='utf-8') as out_f:
        out_f.write(html_content)
    print(f"Generated: {output_html_path} ({os.path.getsize(output_html_path):,} bytes)")

if __name__ == '__main__':
    all_batches = [
        ('Examtopics/batch/batch1_q1_q200.json', 'Examtopics/batch/Examtopics_Batch1_Q1-200.html', 'Batch 1 (Q1 - Q200)', 'b1'),
        ('Examtopics/batch/batch2_q201_q400.json', 'Examtopics/batch/Examtopics_Batch2_Q201-400.html', 'Batch 2 (Q201 - Q400)', 'b2'),
        ('Examtopics/batch/batch3_q401_q600.json', 'Examtopics/batch/Examtopics_Batch3_Q401-600.html', 'Batch 3 (Q401 - Q600)', 'b3'),
        ('Examtopics/batch/batch4_q601_q800.json', 'Examtopics/batch/Examtopics_Batch4_Q601-800.html', 'Batch 4 (Q601 - Q800)', 'b4'),
        ('Examtopics/batch/batch5_q801_q1000.json', 'Examtopics/batch/Examtopics_Batch5_Q801-1000.html', 'Batch 5 (Q801 - Q1000)', 'b5'),
        ('Examtopics/batch/batch6_q1001_q1200.json', 'Examtopics/batch/Examtopics_Batch6_Q1001-1200.html', 'Batch 6 (Q1001 - Q1200)', 'b6'),
        ('Examtopics/batch/batch7_q1201_q1396.json', 'Examtopics/batch/Examtopics_Batch7_Q1201-1396.html', 'Batch 7 (Q1201 - Q1396)', 'b7'),
    ]

    for json_p, html_p, title, suffix in all_batches:
        generate_html(json_p, html_p, title, suffix)

    # Full Master Output (All 1396 questions)
    generate_html(
        json_file_path='Examtopics/output/complete_q1_q1396.json',
        output_html_path='Examtopics/output/Examtopics_CCNA_200-301_Complete.html',
        title_suffix='Full Practice Bank (Q1 - Q1396)',
        storage_suffix='all_master'
    )
    print("ALL 7 Batches and the Master Complete Bank built successfully!")
