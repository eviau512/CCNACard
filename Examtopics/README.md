# ExamTopics CCNA 200-301 Interactive Question Bank Engine

This project converts the CCNA 200-301 Examtopics PDF question bank into responsive, offline-ready, **all-English** single-file HTML practice applications with native dark mode support.

---

## 📁 Project Directory Structure

```text
Examtopics/
├── batch/                                          # Individual batch practice banks (200 questions / batch)
│   ├── Examtopics_Batch1_Q1-200.html               # Batch 1: Questions 1 to 200 (40 pages)
│   ├── Examtopics_Batch2_Q201-400.html             # Batch 2: Questions 201 to 400 (40 pages)
│   ├── Examtopics_Batch3_Q401-600.html             # Batch 3: Questions 401 to 600 (40 pages)
│   ├── Examtopics_Batch4_Q601-800.html             # Batch 4: Questions 601 to 800 (40 pages)
│   ├── Examtopics_Batch5_Q801-1000.html            # Batch 5: Questions 801 to 1000 (40 pages)
│   ├── Examtopics_Batch6_Q1001-1200.html           # Batch 6: Questions 1001 to 1200 (40 pages)
│   ├── Examtopics_Batch7_Q1201-1396.html           # Batch 7: Questions 1201 to 1396 (40 pages)
│   ├── batch1_q1_q200.json                         # Batch 1 JSON dataset with Base64 exhibits
│   ├── batch2_q201_q400.json                       # Batch 2 JSON dataset with Base64 exhibits
│   ├── batch3_q401_q600.json                       # Batch 3 JSON dataset with Base64 exhibits
│   ├── batch4_q601_q800.json                       # Batch 4 JSON dataset with Base64 exhibits
│   ├── batch5_q801_q1000.json                      # Batch 5 JSON dataset with Base64 exhibits
│   ├── batch6_q1001_q1200.json                     # Batch 6 JSON dataset with Base64 exhibits
│   └── batch7_q1201_q1396.json                     # Batch 7 JSON dataset with Base64 exhibits
├── output/                                         # Master consolidated deliverables
│   ├── Examtopics_CCNA_200-301_Complete.html       # Full unified practice engine (1,396 questions, 280 pages)
│   └── complete_q1_q1396.json                      # Master consolidated JSON dataset
├── scripts/                                        # Automation and builder pipeline
│   ├── extract_ccna_fast.py                        # PDF parser & geometric exhibit mapper
│   ├── prepare_data_all.py                         # Explanation synthesizer & batch partitioner
│   └── build_all_html.py                           # Single-file HTML dark mode builder
└── README.md                                       # Project documentation
```

---

## 🎯 Batch Allocation & Completion Status (100% Completed)

| Batch | Question Range | Question Count | Status | Deliverable File | Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | **Q1 ~ Q200** | 200 | **Completed** | `batch/Examtopics_Batch1_Q1-200.html` | ~1.9 MB |
| **Batch 2** | **Q201 ~ Q400** | 200 | **Completed** | `batch/Examtopics_Batch2_Q201-400.html` | ~4.6 MB |
| **Batch 3** | **Q401 ~ Q600** | 200 | **Completed** | `batch/Examtopics_Batch3_Q401-600.html` | ~1.3 MB |
| **Batch 4** | **Q601 ~ Q800** | 200 | **Completed** | `batch/Examtopics_Batch4_Q601-800.html` | ~2.5 MB |
| **Batch 5** | **Q801 ~ Q1000** | 199* | **Completed** | `batch/Examtopics_Batch5_Q801-1000.html` | ~2.0 MB |
| **Batch 6** | **Q1001 ~ Q1200** | 200 | **Completed** | `batch/Examtopics_Batch6_Q1001-1200.html` | ~6.7 MB |
| **Batch 7** | **Q1201 ~ Q1396** | 197 | **Completed** | `batch/Examtopics_Batch7_Q1201-1396.html` | ~2.5 MB |
| **Master Complete** | **Q1 ~ Q1396** | **1,396** | **Completed** | `output/Examtopics_CCNA_200-301_Complete.html` | ~21.2 MB |

*\*Note: Question ID 848 was skipped in the source PDF numbering; hence Q801-Q1000 contains 199 questions, totaling exactly 1,396 questions across Q1-Q1397.*

---

## 📱 Key Features & Design Specifications

1. **Dark Mode Default & Theme Toggle**:
   - High-contrast, eye-friendly dark mode enabled by default (`[data-theme="dark"]`).
   - One-click `🌙 / ☀️` theme switch in the sticky navigation header with persistent theme state.
2. **True Single-File Zero-Dependency Architecture**:
   - Zero external scripts, CSS links, or image folders.
   - All 500+ diagrams and exhibits are embedded directly inside the `.html` file as Base64 data URIs.
   - Works 100% offline in any modern desktop or mobile browser (Chrome, Edge, Safari, Firefox).
3. **Strict 5-Questions-Per-Page Pagination**:
   - 5 questions per page layout with responsive top and bottom pagination controls and direct page jump navigation.
4. **Interactive Practice & Instant Grading**:
   - Radio buttons for Single Choice, checkboxes for Multiple Choice questions.
   - Interactive Drag & Drop / Simulation question support (problem diagrams and solution target exhibits).
   - "Check Answer" gives immediate color-coded feedback (emerald green for correct, ruby red for incorrect).
   - "Reveal Answer" toggle displays the verified correct answer and comprehensive CCNA technical explanation.
5. **Mobile-Compatible Practice Tracking (`localStorage`)**:
   - Automatically tracks user selections, submitted state, correctness, and bookmarks.
   - Works seamlessly on mobile devices without cookies or server backends.
   - 4-way filter: `All`, `Unanswered`, `Incorrect` (Wrong Questions Notebook), and `Bookmarked`.
   - **Question Matrix**: Visual modal grid of all questions color-coded by practice status, with click-to-jump navigation.
   - **JSON Export / Import**: Easily backup and transfer study progress between phone and PC.
