// Vercel Serverless Function — /api/water-report
// Returns water quality data for a given ZIP code.
// Sources: EPA Envirofacts (live violations), EWG (pre-cached contaminants), CCR (hardness)

// ─── ZIP → PWSID Lookup ────────────────────────────────────────────────────
const ZIP_TO_PWSIDS = {
  // ── Sugar Land ──────────────────────────────────────────────────────────
  '77478': ['TX0790005'],
  '77479': ['TX0790005', 'TX0790354'],
  '77496': ['TX0790005'],
  '77498': ['TX0790005'],
  '77499': ['TX0790005'],
  // Meadows Place
  '77477': ['TX0790005'],
  // New Territory / Greatwood
  '77494': ['TX0790316', 'TX0790299'],
  // Missouri City
  '77459': ['TX0791014'],
  '77489': ['TX0791014'],
  // Richmond / Rosenberg
  '77406': ['TX0790017'],
  '77407': ['TX0790017'],
  '77469': ['TX0790017'],
  // Pearland
  '77581': ['TX0201450'],
  '77584': ['TX0201450'],
  // Katy
  '77449': ['TX0481218'],
  '77450': ['TX0481218'],

  // ── City of Houston (TX1010013) — all 770xx ZIPs ────────────────────────
  '77001': ['TX1010013'], '77002': ['TX1010013'], '77003': ['TX1010013'],
  '77004': ['TX1010013'], '77006': ['TX1010013'], '77007': ['TX1010013'],
  '77008': ['TX1010013'], '77009': ['TX1010013'], '77010': ['TX1010013'],
  '77011': ['TX1010013'], '77012': ['TX1010013'], '77013': ['TX1010013'],
  '77014': ['TX1010013'], '77015': ['TX1010013'], '77016': ['TX1010013'],
  '77017': ['TX1010013'], '77018': ['TX1010013'], '77019': ['TX1010013'],
  '77020': ['TX1010013'], '77021': ['TX1010013'], '77022': ['TX1010013'],
  '77023': ['TX1010013'], '77024': ['TX1010013'], '77025': ['TX1010013'],
  '77026': ['TX1010013'], '77027': ['TX1010013'], '77028': ['TX1010013'],
  '77029': ['TX1010013'], '77030': ['TX1010013'], '77031': ['TX1010013'],
  '77032': ['TX1010013'], '77033': ['TX1010013'], '77034': ['TX1010013'],
  '77035': ['TX1010013'], '77036': ['TX1010013'], '77037': ['TX1010013'],
  '77038': ['TX1010013'], '77039': ['TX1010013'], '77040': ['TX1010013'],
  '77041': ['TX1010013'], '77042': ['TX1010013'], '77043': ['TX1010013'],
  '77044': ['TX1010013'], '77045': ['TX1010013'], '77046': ['TX1010013'],
  '77047': ['TX1010013'], '77048': ['TX1010013'], '77049': ['TX1010013'],
  '77050': ['TX1010013'], '77051': ['TX1010013'], '77052': ['TX1010013'],
  '77053': ['TX1010013'], '77054': ['TX1010013'], '77055': ['TX1010013'],
  '77056': ['TX1010013'], '77057': ['TX1010013'], '77058': ['TX1010013'],
  '77059': ['TX1010013'], '77060': ['TX1010013'], '77061': ['TX1010013'],
  '77062': ['TX1010013'], '77063': ['TX1010013'], '77064': ['TX1010013'],
  '77065': ['TX1010013'], '77066': ['TX1010013'], '77067': ['TX1010013'],
  '77068': ['TX1010013'], '77069': ['TX1010013'], '77070': ['TX1010013'],
  '77071': ['TX1010013'], '77072': ['TX1010013'], '77073': ['TX1010013'],
  '77074': ['TX1010013'], '77075': ['TX1010013'], '77076': ['TX1010013'],
  '77077': ['TX1010013'], '77078': ['TX1010013'], '77079': ['TX1010013'],
  '77080': ['TX1010013'], '77081': ['TX1010013'], '77082': ['TX1010013'],
  '77083': ['TX1010013'], '77084': ['TX1010013'], '77085': ['TX1010013'],
  '77086': ['TX1010013'], '77087': ['TX1010013'], '77088': ['TX1010013'],
  '77089': ['TX1010013'], '77090': ['TX1010013'], '77091': ['TX1010013'],
  '77092': ['TX1010013'], '77093': ['TX1010013'], '77094': ['TX1010013'],
  '77095': ['TX1010013'], '77096': ['TX1010013'], '77097': ['TX1010013'],
  '77098': ['TX1010013'], '77099': ['TX1010013'],

  // ── West University Place / 77005 (majority West U system) ──────────────
  '77005': ['TX1010027'],

  // ── Bellaire ────────────────────────────────────────────────────────────
  '77401': ['TX1010004'],
  '77402': ['TX1010004'],

  // ── Kingwood (groundwater — different profile) ───────────────────────────
  '77339': ['TX1010348'],
  '77345': ['TX1010348'],
  '77346': ['TX1010348'],
  '77365': ['TX1010348'],
};

// ─── System Data + Pre-Cached EWG Contaminants ────────────────────────────
const SYSTEMS = {

  // ── Sugar Land Main ─────────────────────────────────────────────────────
  'TX0790005': {
    name: 'City of Sugar Land',
    area: 'Sugar Land (Main System)',
    source: 'Surface Water — Brazos River',
    population: 118000,
    hardness: { min_ppm: 35, max_ppm: 280, min_gpg: 2.0, max_gpg: 16.4, label: 'Moderately Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790005',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: [
      { name: 'PFAS — 6:2 FTSA', category: 'pfas', level: 60.2, unit: 'ppt', ewg_guideline: 1, epa_limit: null, times_over_guideline: 60, concern: 'Linked to cancer, immune disruption, and hormone interference.', solution: 'Reverse osmosis removes 95–99% of PFAS from drinking water.' },
      { name: 'PFOA', category: 'pfas', level: 0.368, unit: 'ppt', ewg_guideline: 0.1, epa_limit: 4, times_over_guideline: 3.7, concern: 'Carcinogen linked to kidney and testicular cancer, developmental effects.', solution: 'Reverse osmosis effectively removes PFOA.' },
      { name: 'Arsenic', category: 'heavy_metal', level: 0.5, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 125, concern: 'Carcinogen. Long-term exposure linked to skin, bladder, and lung cancer.', solution: 'Reverse osmosis and activated alumina filters remove arsenic.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.655, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 33, concern: 'Known carcinogen. No safe EPA limit established yet.', solution: 'Reverse osmosis and strong base anion exchange filters are effective.' },
      { name: 'Nitrate', category: 'nitrate', level: 1.05, unit: 'ppm', ewg_guideline: 0.14, epa_limit: 10, times_over_guideline: 7.5, concern: 'Linked to colorectal cancer. Particularly harmful for infants under 6 months.', solution: 'Reverse osmosis and ion exchange filters remove nitrates.' },
      { name: 'Uranium', category: 'radionuclide', level: 1.2, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 30, times_over_guideline: 2.8, concern: 'Kidney toxicity and radiation exposure with long-term consumption.', solution: 'Reverse osmosis reduces uranium levels significantly.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 3.18, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 21, concern: 'Formed when chlorine reacts with organic matter. Linked to cancer and reproductive effects.', solution: 'Whole-home carbon filtration removes chlorine and reduces DBPs at every tap.' },
      { name: 'Haloacetic Acids (HAA5)', category: 'disinfection_byproduct', level: 4.13, unit: 'ppb', ewg_guideline: 0.1, epa_limit: 60, times_over_guideline: 41, concern: 'Disinfection byproducts associated with increased cancer risk.', solution: 'Activated carbon filtration and RO both reduce HAA5.' },
    ],
  },

  // ── Sugar Land River Park ────────────────────────────────────────────────
  'TX0790354': {
    name: 'City of Sugar Land — River Park',
    area: 'River Park',
    source: 'Surface Water — Brazos River',
    population: 8000,
    hardness: { min_ppm: 109, max_ppm: 155, min_gpg: 6.4, max_gpg: 9.1, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790354',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: null, // falls back to TX0790005
  },

  // ── Sugar Land Greatwood ─────────────────────────────────────────────────
  'TX0790299': {
    name: 'City of Sugar Land — Greatwood',
    area: 'Greatwood',
    source: 'Surface Water — Brazos River',
    population: 12000,
    hardness: { min_ppm: 34, max_ppm: 164, min_gpg: 2.0, max_gpg: 9.6, label: 'Soft to Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790299',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: null,
  },

  // ── Sugar Land New Territory ─────────────────────────────────────────────
  'TX0790316': {
    name: 'City of Sugar Land — New Territory',
    area: 'New Territory',
    source: 'Surface Water — Brazos River',
    population: 15000,
    hardness: { min_ppm: 50, max_ppm: 186, min_gpg: 2.9, max_gpg: 10.9, label: 'Moderately Hard to Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790316',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: null,
  },

  // ── City of Houston (Main) ───────────────────────────────────────────────
  'TX1010013': {
    name: 'City of Houston Water',
    area: 'Houston',
    source: 'Surface Water — Lake Livingston & Lake Houston',
    population: 2202531,
    hardness: { min_ppm: 100, max_ppm: 140, min_gpg: 6.0, max_gpg: 8.0, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX1010013',
    ccr_url: 'https://www.houstonpublicworks.org/drinking-water-quality-report',
    contaminants: [
      { name: 'Arsenic', category: 'heavy_metal', level: 2.06, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 516, concern: 'Carcinogen. Long-term exposure linked to skin, bladder, and lung cancer.', solution: 'Reverse osmosis removes arsenic from drinking water.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.747, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 37, concern: 'Known carcinogen — no federal legal limit has been established yet.', solution: 'Reverse osmosis and anion exchange filters remove hexavalent chromium.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 30.4, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 203, concern: 'Formed when disinfectants react with organic matter in source water. Linked to cancer and reproductive effects.', solution: 'Whole-home carbon filtration removes THMs at every tap in the house.' },
      { name: 'Haloacetic Acids (HAA5)', category: 'disinfection_byproduct', level: 21.2, unit: 'ppb', ewg_guideline: 0.1, epa_limit: 60, times_over_guideline: 212, concern: 'Disinfection byproducts associated with increased cancer risk.', solution: 'Activated carbon filtration and reverse osmosis both reduce HAA5 levels.' },
      { name: 'Bromochloroacetic Acid', category: 'disinfection_byproduct', level: 4.57, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 229, concern: 'Disinfection byproduct with no federal legal limit — potential carcinogen.', solution: 'Carbon filtration reduces haloacetic acid formation byproducts.' },
      { name: 'Chloroform', category: 'disinfection_byproduct', level: 13.7, unit: 'ppb', ewg_guideline: 0.4, epa_limit: null, times_over_guideline: 34, concern: 'Volatile trihalomethane — can be absorbed through skin in the shower, not just drinking.', solution: 'Whole-home carbon filtration reduces chloroform at all taps including showers.' },
      { name: 'Radium (226 + 228)', category: 'radionuclide', level: 0.85, unit: 'pCi/L', ewg_guideline: 0.05, epa_limit: 5, times_over_guideline: 17, concern: 'Radioactive element associated with bone cancer and leukemia with long-term exposure.', solution: 'Reverse osmosis and ion exchange systems reduce radium.' },
      { name: 'Uranium', category: 'radionuclide', level: 2.19, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 20, times_over_guideline: 5.1, concern: 'Kidney toxicity and low-level radiation exposure with long-term consumption.', solution: 'Reverse osmosis significantly reduces uranium levels.' },
      { name: 'PFAS — 6:2 FTSA', category: 'pfas', level: 1.69, unit: 'ppt', ewg_guideline: 1, epa_limit: null, times_over_guideline: 1.7, concern: 'Forever chemicals linked to cancer, immune disruption, and hormone interference.', solution: 'Reverse osmosis removes 95–99% of PFAS compounds.' },
      { name: 'Nitrate', category: 'nitrate', level: 0.155, unit: 'ppm', ewg_guideline: 0.14, epa_limit: 10, times_over_guideline: 1.1, concern: 'Linked to colorectal cancer. Particularly harmful for infants under 6 months.', solution: 'Reverse osmosis and ion exchange remove nitrates.' },
    ],
  },

  // ── West University Place ────────────────────────────────────────────────
  'TX1010027': {
    name: 'City of West University Place',
    area: 'West University Place',
    source: 'Surface Water (purchased from Houston) + City Wells',
    population: 19200,
    hardness: { min_ppm: 100, max_ppm: 150, min_gpg: 6.0, max_gpg: 8.8, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX1010027',
    ccr_url: 'https://www.westutx.gov/215/Water-Quality',
    contaminants: [
      { name: 'Arsenic', category: 'heavy_metal', level: 2.95, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 738, concern: 'The highest arsenic reading in the greater Houston area. Carcinogen linked to bladder, lung, and skin cancer.', solution: 'Reverse osmosis removes arsenic from drinking water.' },
      { name: 'PFOS', category: 'pfas', level: 3.39, unit: 'ppt', ewg_guideline: 0.3, epa_limit: 4, times_over_guideline: 11, concern: 'PFAS compound linked to cancer and immune system disruption.', solution: 'Reverse osmosis removes 95–99% of PFAS compounds.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.65, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 33, concern: 'Known carcinogen with no established federal legal limit.', solution: 'Reverse osmosis and anion exchange filtration are effective.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 28.1, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 187, concern: 'High levels from chloramine treatment of surface water. Linked to cancer and reproductive effects.', solution: 'Whole-home carbon filtration reduces TTHMs at every tap.' },
      { name: 'Haloacetic Acids (HAA5)', category: 'disinfection_byproduct', level: 19.8, unit: 'ppb', ewg_guideline: 0.1, epa_limit: 60, times_over_guideline: 198, concern: 'Disinfection byproducts associated with increased cancer risk.', solution: 'Carbon filtration and reverse osmosis both reduce HAA5.' },
      { name: 'Uranium', category: 'radionuclide', level: 2.19, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 20, times_over_guideline: 5.1, concern: 'Kidney toxicity and radiation exposure with long-term consumption.', solution: 'Reverse osmosis significantly reduces uranium.' },
    ],
  },

  // ── Bellaire ────────────────────────────────────────────────────────────
  'TX1010004': {
    name: 'City of Bellaire',
    area: 'Bellaire',
    source: 'Surface Water — Purchased from City of Houston',
    population: 19401,
    hardness: { min_ppm: 130, max_ppm: 160, min_gpg: 7.6, max_gpg: 9.4, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX1010004',
    ccr_url: 'https://www.bellairetx.gov/246/Water-Quality',
    contaminants: [
      { name: 'Arsenic', category: 'heavy_metal', level: 2.15, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 538, concern: 'Carcinogen. Long-term exposure linked to skin, bladder, and lung cancer.', solution: 'Reverse osmosis removes arsenic from drinking water.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.0573, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 2.9, concern: 'Known carcinogen — no federal legal limit established.', solution: 'Reverse osmosis and anion exchange filtration are effective.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 24.5, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 163, concern: 'Formed when disinfectants react with organic matter in source water. Linked to cancer and reproductive effects.', solution: 'Whole-home carbon filtration reduces TTHMs at every tap in the house.' },
      { name: 'Haloacetic Acids (HAA5)', category: 'disinfection_byproduct', level: 20.6, unit: 'ppb', ewg_guideline: 0.1, epa_limit: 60, times_over_guideline: 206, concern: 'Disinfection byproducts associated with increased cancer risk.', solution: 'Carbon filtration and reverse osmosis both reduce HAA5 levels.' },
      { name: 'Radium (226 + 228)', category: 'radionuclide', level: 0.68, unit: 'pCi/L', ewg_guideline: 0.05, epa_limit: 5, times_over_guideline: 14, concern: 'Radioactive element associated with bone cancer and leukemia with long-term exposure.', solution: 'Reverse osmosis and ion exchange systems reduce radium.' },
      { name: 'Uranium', category: 'radionuclide', level: 2.19, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 20, times_over_guideline: 5.1, concern: 'Kidney toxicity and radiation exposure with long-term consumption.', solution: 'Reverse osmosis significantly reduces uranium levels.' },
    ],
  },

  // ── Kingwood (Groundwater — different profile) ───────────────────────────
  'TX1010348': {
    name: 'Houston Utility District 5 — Kingwood',
    area: 'Kingwood',
    source: 'Groundwater — Evangeline & Chicot Aquifers',
    population: 80073,
    hardness: { min_ppm: 170, max_ppm: 250, min_gpg: 10.0, max_gpg: 14.6, label: 'Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX1010348',
    ccr_url: 'https://www.houstonpublicworks.org/drinking-water-quality-report',
    contaminants: [
      { name: 'Arsenic', category: 'heavy_metal', level: 1.10, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 275, concern: 'Carcinogen found naturally in groundwater aquifers. Linked to bladder, lung, and skin cancer.', solution: 'Reverse osmosis removes arsenic effectively from drinking water.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.223, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 11, concern: 'Known carcinogen — no federal limit established. Found naturally in groundwater.', solution: 'Reverse osmosis and anion exchange filtration remove hexavalent chromium.' },
      { name: 'Uranium', category: 'radionuclide', level: 1.8, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 20, times_over_guideline: 4.2, concern: 'Naturally occurring in Evangeline Aquifer groundwater. Kidney toxicity risk.', solution: 'Reverse osmosis reduces uranium significantly.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 1.18, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 7.9, concern: 'Much lower than surface water systems — but still above health guidelines.', solution: 'Carbon filtration handles residual DBPs in treated groundwater.' },
    ],
  },

  // ── City of Katy (Groundwater) ───────────────────────────────────────────
  'TX1010017': {
    name: 'City of Katy',
    area: 'Katy',
    source: 'Groundwater — Chicot & Evangeline Aquifers',
    population: 21894,
    hardness: { min_ppm: 160, max_ppm: 230, min_gpg: 9.4, max_gpg: 13.5, label: 'Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX1010017',
    ccr_url: 'https://www.cityofkaty.com/departments/public-works/water-quality',
    contaminants: [
      { name: 'Arsenic', category: 'heavy_metal', level: 2.37, unit: 'ppb', ewg_guideline: 0.004, epa_limit: 10, times_over_guideline: 592, concern: 'Naturally occurring carcinogen found in groundwater. Linked to bladder, lung, and skin cancer.', solution: 'Reverse osmosis removes arsenic effectively from drinking water.' },
      { name: 'Chromium (Hexavalent)', category: 'heavy_metal', level: 0.048, unit: 'ppb', ewg_guideline: 0.02, epa_limit: null, times_over_guideline: 2.4, concern: 'Known carcinogen — no federal limit established. Found in Katy area groundwater.', solution: 'Reverse osmosis and anion exchange filtration remove hexavalent chromium.' },
      { name: 'Radium (226 + 228)', category: 'radionuclide', level: 1.25, unit: 'pCi/L', ewg_guideline: 0.05, epa_limit: 5, times_over_guideline: 25, concern: 'Radioactive element associated with bone cancer and leukemia. Elevated in groundwater-sourced systems.', solution: 'Reverse osmosis and ion exchange systems reduce radium effectively.' },
      { name: 'Uranium', category: 'radionuclide', level: 3.07, unit: 'pCi/L', ewg_guideline: 0.43, epa_limit: 20, times_over_guideline: 7.1, concern: 'Kidney toxicity and radiation exposure with long-term groundwater consumption.', solution: 'Reverse osmosis significantly reduces uranium.' },
      { name: 'Total Trihalomethanes (TTHMs)', category: 'disinfection_byproduct', level: 0.806, unit: 'ppb', ewg_guideline: 0.15, epa_limit: 80, times_over_guideline: 5.4, concern: 'Lower than surface water systems but still above health guidelines. Residual from disinfection treatment.', solution: 'Carbon filtration handles residual disinfection byproducts effectively.' },
      { name: 'Haloacetic Acids (HAA5)', category: 'disinfection_byproduct', level: 0.927, unit: 'ppb', ewg_guideline: 0.1, epa_limit: 60, times_over_guideline: 9.3, concern: 'Disinfection byproducts associated with increased cancer risk.', solution: 'Carbon filtration and reverse osmosis both reduce HAA5 levels.' },
    ],
  },

  // ── Missouri City ─────────────────────────────────────────────────────────
  'TX0791014': {
    name: 'Missouri City Water System',
    area: 'Missouri City',
    source: 'Surface Water — Brazos River',
    population: 74259,
    hardness: { min_ppm: 50, max_ppm: 240, min_gpg: 2.9, max_gpg: 14.0, label: 'Moderately Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0791014',
    ccr_url: 'https://www.missouricitytx.gov/government/departments/public-works',
    contaminants: null, // falls back to TX0790005 — same Brazos River basin, comparable contaminant profile
  },

  // ── Richmond / Rosenberg ──────────────────────────────────────────────────
  'TX0790017': {
    name: 'Fort Bend County Water System — Richmond/Rosenberg',
    area: 'Richmond / Rosenberg',
    source: 'Surface Water — Brazos River',
    population: 55000,
    hardness: { min_ppm: 50, max_ppm: 250, min_gpg: 2.9, max_gpg: 14.6, label: 'Moderately Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790017',
    ccr_url: 'https://www.fortbendcountytx.gov',
    contaminants: null, // falls back to TX0790005 — same Fort Bend County / Brazos River system
  },

  // ── Pearland ──────────────────────────────────────────────────────────────
  'TX0201450': {
    name: 'City of Pearland Water System',
    area: 'Pearland',
    source: 'Surface Water — Gulf Coast Water Authority / Brazos River',
    population: 130937,
    hardness: { min_ppm: 100, max_ppm: 180, min_gpg: 5.8, max_gpg: 10.5, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0201450',
    ccr_url: 'https://www.pearlandtx.gov/departments/public-works/utilities/water-quality',
    contaminants: null, // falls back to TX1010013 — similar Gulf Coast surface water profile
  },

  // ── Katy Water Utility District ───────────────────────────────────────────
  'TX0481218': {
    name: 'Katy Water System',
    area: 'Katy',
    source: 'Groundwater — Chicot & Evangeline Aquifers',
    population: 25000,
    hardness: { min_ppm: 160, max_ppm: 230, min_gpg: 9.4, max_gpg: 13.5, label: 'Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0481218',
    ccr_url: 'https://www.cityofkaty.com/departments/public-works/water-quality',
    contaminants: null, // falls back to TX1010017 — City of Katy, same groundwater aquifer system
  },
};

// ─── Fallback chain for contaminant data ──────────────────────────────────
const FALLBACKS = {
  // Sugar Land sub-systems → Sugar Land Main
  'TX0790354': 'TX0790005',
  'TX0790299': 'TX0790005',
  'TX0790316': 'TX0790005',
  // Fort Bend County surface water → Sugar Land Main (same Brazos River basin)
  'TX0791014': 'TX0790005',
  'TX0790017': 'TX0790005',
  // Pearland → Houston (similar Gulf Coast surface water profile)
  'TX0201450': 'TX1010013',
  // Katy district → City of Katy (same groundwater aquifer system)
  'TX0481218': 'TX1010017',
};

// ─── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { zip } = req.query;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Enter a valid 5-digit ZIP code.' });
  }

  const pwsids = ZIP_TO_PWSIDS[zip];
  if (!pwsids) {
    return res.status(404).json({
      error: 'outside_area',
      message: `We don't have data cached for ZIP ${zip} yet — but we may still serve your area. Call Kurt at (713) 822-1308 and he'll tell you exactly what's in your water.`,
    });
  }

  const primaryId = pwsids[0];
  const primarySystem = SYSTEMS[primaryId] || null;

  // Resolve contaminants — use fallback system if primary has none cached
  const fallbackId = FALLBACKS[primaryId];
  const contaminants =
    primarySystem?.contaminants ||
    (fallbackId ? SYSTEMS[fallbackId]?.contaminants : null) ||
    [];

  // ── Live violation fetch from EPA ──────────────────────────────────────
  let violations = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const epaRes = await fetch(
      `https://data.epa.gov/efservice/VIOLATION/PWSID/${primaryId}/JSON`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (epaRes.ok) {
      const raw = await epaRes.json();
      violations = (Array.isArray(raw) ? raw : [])
        .filter(v => v.VIOLATION_CATEGORY_CODE === 'HC' || v.VIOLATION_CATEGORY_CODE === 'MR')
        .map(v => ({
          contaminant: v.CONTAMINANT_CODE_DESCRIPTION || v.CONTAMINANT_CODE || 'Unknown',
          category: v.VIOLATION_CATEGORY_CODE,
          type: v.VIOLATION_CODE_DESCRIPTION || v.VIOLATION_CODE || '',
          begin_date: v.COMPL_PER_BEGIN_DATE || null,
          end_date: v.COMPL_PER_END_DATE || null,
          status: v.VIOLATION_STATUS || '',
          is_health_based: v.IS_HEALTH_BASED_IND === 'Y',
        }))
        .slice(0, 10);
    }
  } catch (_) {
    // EPA call failed — return cached data only
  }

  return res.status(200).json({
    zip,
    pwsid: primaryId,
    all_systems: pwsids,
    system: primarySystem ? {
      name: primarySystem.name,
      area: primarySystem.area,
      source: primarySystem.source,
      population: primarySystem.population,
      hardness: primarySystem.hardness,
      ewg_url: primarySystem.ewg_url,
      ccr_url: primarySystem.ccr_url,
    } : null,
    contaminants,
    violations,
    sources: {
      contaminants: 'EWG Tap Water Database (2013–2024 monitoring data)',
      violations: 'EPA Safe Drinking Water Information System (live)',
      hardness: 'Houston Public Works & Sugar Land Annual Water Quality Reports',
    },
  });
}
