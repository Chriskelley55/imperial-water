// Vercel Serverless Function — /api/water-report
// Returns water quality data for a given ZIP code.
// Sources: EPA Envirofacts (violations), ECHO (system info), EWG (pre-cached contaminants), CCR (hardness)

// ─── ZIP → PWSID Lookup ────────────────────────────────────────────────────
const ZIP_TO_PWSIDS = {
  // Sugar Land
  '77478': ['TX0790005'],
  '77479': ['TX0790005', 'TX0790354'],
  '77496': ['TX0790005'],
  '77498': ['TX0790005'],
  '77499': ['TX0790005'],
  // Meadows Place
  '77477': ['TX0790005'],
  // New Territory / Greatwood (Sugar Land systems)
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
};

// ─── System Info + Pre-Cached EWG Contaminant Data ────────────────────────
const SYSTEMS = {
  'TX0790005': {
    name: 'City of Sugar Land',
    area: 'Sugar Land (Main System)',
    source: 'Surface Water — Brazos River',
    population: 118000,
    hardness: { min_ppm: 35, max_ppm: 280, min_gpg: 2.0, max_gpg: 16.4, label: 'Moderately Hard to Very Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790005',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: [
      {
        name: 'PFAS — 6:2 FTSA',
        category: 'pfas',
        level: 60.2, unit: 'ppt',
        ewg_guideline: 1, epa_limit: null,
        times_over_guideline: 60,
        concern: 'Linked to cancer, immune system disruption, and hormone interference.',
        solution: 'Reverse osmosis removes 95–99% of PFAS from drinking water.',
      },
      {
        name: 'PFOA',
        category: 'pfas',
        level: 0.368, unit: 'ppt',
        ewg_guideline: 0.1, epa_limit: 4,
        times_over_guideline: 3.7,
        concern: 'Carcinogen linked to kidney and testicular cancer, developmental effects.',
        solution: 'Reverse osmosis effectively removes PFOA.',
      },
      {
        name: 'Arsenic',
        category: 'heavy_metal',
        level: 0.5, unit: 'ppb',
        ewg_guideline: 0.004, epa_limit: 10,
        times_over_guideline: 125,
        concern: 'Carcinogen. Long-term exposure linked to skin, bladder, and lung cancer.',
        solution: 'Reverse osmosis and activated alumina filters remove arsenic.',
      },
      {
        name: 'Nitrate',
        category: 'nitrate',
        level: 1.05, unit: 'ppm',
        ewg_guideline: 0.14, epa_limit: 10,
        times_over_guideline: 7.5,
        concern: 'Linked to colorectal cancer. Particularly harmful for infants under 6 months.',
        solution: 'Reverse osmosis and ion exchange filters remove nitrates.',
      },
      {
        name: 'Uranium',
        category: 'radionuclide',
        level: 1.2, unit: 'pCi/L',
        ewg_guideline: 0.43, epa_limit: 30,
        times_over_guideline: 2.8,
        concern: 'Kidney toxicity and radiation exposure with long-term consumption.',
        solution: 'Reverse osmosis reduces uranium levels significantly.',
      },
      {
        name: 'Chromium (Hexavalent)',
        category: 'heavy_metal',
        level: 0.655, unit: 'ppb',
        ewg_guideline: 0.02, epa_limit: null,
        times_over_guideline: 33,
        concern: 'Known carcinogen. No safe EPA limit established yet.',
        solution: 'Reverse osmosis and strong base anion exchange filters are effective.',
      },
      {
        name: 'Total Trihalomethanes (TTHMs)',
        category: 'disinfection_byproduct',
        level: 3.18, unit: 'ppb',
        ewg_guideline: 0.15, epa_limit: 80,
        times_over_guideline: 21,
        concern: 'Formed when chlorine reacts with organic matter. Linked to cancer and reproductive effects.',
        solution: 'Whole-home carbon filtration removes chlorine and reduces DBPs at every tap.',
      },
      {
        name: 'Haloacetic Acids (HAA5)',
        category: 'disinfection_byproduct',
        level: 4.13, unit: 'ppb',
        ewg_guideline: 0.1, epa_limit: 60,
        times_over_guideline: 41,
        concern: 'Disinfection byproducts associated with increased cancer risk.',
        solution: 'Activated carbon filtration and RO both reduce HAA5.',
      },
    ],
  },
  'TX0790354': {
    name: 'City of Sugar Land — River Park',
    area: 'River Park',
    source: 'Surface Water — Brazos River',
    population: 8000,
    hardness: { min_ppm: 109, max_ppm: 155, min_gpg: 6.4, max_gpg: 9.1, label: 'Hard' },
    ewg_url: 'https://www.ewg.org/tapwater/system.php?pws=TX0790354',
    ccr_url: 'https://www.sugarlandtx.gov/329/Water-Quality',
    contaminants: null, // Falls back to TX0790005 data
  },
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
};

// ─── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // cache 24h

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

  // Use contaminants from primary system, or fall back to main Sugar Land system
  const contaminants =
    primarySystem?.contaminants || SYSTEMS['TX0790005']?.contaminants || [];

  // ── Fetch live violations from EPA Envirofacts ──
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
        .filter(v =>
          v.VIOLATION_CATEGORY_CODE === 'HC' || // Health-based
          v.VIOLATION_CATEGORY_CODE === 'MR'    // Monitoring/reporting
        )
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
    // EPA call failed — proceed without violations
  }

  return res.status(200).json({
    zip,
    pwsid: primaryId,
    all_systems: pwsids,
    system: primarySystem
      ? {
          name: primarySystem.name,
          area: primarySystem.area,
          source: primarySystem.source,
          population: primarySystem.population,
          hardness: primarySystem.hardness,
          ewg_url: primarySystem.ewg_url,
          ccr_url: primarySystem.ccr_url,
        }
      : null,
    contaminants,
    violations,
    sources: {
      contaminants: 'EWG Tap Water Database (2013–2023 monitoring data)',
      violations: 'EPA Safe Drinking Water Information System (live)',
      hardness: 'City of Sugar Land Annual Water Quality Report 2022',
    },
  });
}
