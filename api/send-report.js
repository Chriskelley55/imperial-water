// Vercel Serverless Function — POST /api/send-report
// Sends a branded water quality email report via Resend
// and logs the lead to the Google Sheet webhook.

const CATEGORY_LABELS = {
  pfas:                   'PFAS / Forever Chemicals',
  heavy_metal:            'Heavy Metals',
  nitrate:                'Nitrates',
  radionuclide:           'Radionuclides',
  disinfection_byproduct: 'Disinfection Byproducts',
};

function getSeverityLabel(t) {
  if (t >= 100) return 'EXTREMELY HIGH';
  if (t >= 20)  return 'VERY HIGH';
  if (t >= 5)   return 'HIGH';
  if (t >= 1)   return 'ELEVATED';
  return 'ABOVE GUIDELINE';
}

function getSeverityColor(t) {
  if (t >= 100) return '#7f1d1d';
  if (t >= 20)  return '#dc2626';
  if (t >= 5)   return '#ea580c';
  return '#d97706';
}

function calculateScore(contaminants) {
  const above = (contaminants || []).filter(c => (c.times_over_guideline || 0) >= 1);
  let penalty = 0;
  for (const c of above) {
    const m = Math.max(c.times_over_guideline, 1.01);
    penalty += Math.min(5 + Math.log10(m) * 8, 20);
  }
  penalty += above.length * 2;
  return Math.max(0, Math.round(100 / (1 + penalty / 40)));
}

function buildEmailHTML(zip, reportData) {
  const { system = {}, contaminants = [], violations = [] } = reportData;
  const areaShort   = (system.area || 'your area').replace(/\s*\(.*?\)\s*/, '').trim() || 'your area';
  const isFortBend  = ['Sugar Land', 'River Park', 'Greatwood', 'New Territory', 'Missouri City', 'Richmond'].some(n => areaShort.includes(n));
  const localRegion = isFortBend ? 'Fort Bend County' : 'the greater Houston region';

  const score      = calculateScore(contaminants);
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : score >= 20 ? '#dc2626' : '#991b1b';
  const verdict    = score >= 80 ? 'Good' : score >= 60 ? 'Fair' : score >= 40 ? 'Poor' : score >= 20 ? 'Very Poor' : 'Critical';

  // Build contaminant rows grouped by category
  const grouped = {};
  for (const c of contaminants) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }
  let contaminantRows = '';
  for (const [cat, items] of Object.entries(grouped)) {
    contaminantRows += `
      <tr>
        <td colspan="2" style="padding:12px 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;border-top:1px solid #e5e7eb;">
          ${CATEGORY_LABELS[cat] || cat}
        </td>
      </tr>`;
    for (const c of items) {
      const label = getSeverityLabel(c.times_over_guideline);
      const color = getSeverityColor(c.times_over_guideline);
      const mult  = c.times_over_guideline >= 1 ? ` · ${c.times_over_guideline}×` : '';
      contaminantRows += `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#111827;vertical-align:middle;">${c.name}</td>
          <td style="padding:8px 0;text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:${color}18;border:1px solid ${color}50;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;color:${color};">${label}${mult}</span>
          </td>
        </tr>`;
    }
  }

  // Build recommendations
  const cats    = new Set(contaminants.map(c => c.category));
  const hardness = system.hardness?.max_gpg || 0;
  const recs    = [];

  if (cats.has('pfas') || cats.has('heavy_metal') || cats.has('nitrate') || cats.has('radionuclide')) {
    recs.push({ icon: '💧', title: 'Under-Sink Reverse Osmosis', desc: 'Removes PFAS, heavy metals, nitrates, and radionuclides from your drinking water — 95–99% reduction at the tap. The most important investment for contaminated source water.' });
  }
  if (cats.has('disinfection_byproduct')) {
    recs.push({ icon: '🌊', title: 'Whole-Home Carbon Filtration', desc: 'Reduces TTHMs and haloacetic acids at every tap in the house — including your shower, laundry, and kids\' bath, not just the kitchen.' });
  }
  if (hardness > 7) {
    const sev = hardness > 15 ? 'aggressively' : hardness > 10 ? 'significantly' : 'notably';
    recs.push({ icon: '⚗️', title: 'Water Softener', desc: `At ${hardness} GPG, your water is ${sev} hard. A whole-home softener protects appliances and pipes — and typically pays for itself in 2–4 years.` });
  }
  if (recs.length === 0) {
    recs.push({ icon: '✅', title: 'Baseline Filtration', desc: 'Your water is relatively clean. A basic carbon filter is still a smart investment for taste, odor, and long-term peace of mind.' });
  }

  const recsHTML = recs.map((r, i) => `
    <tr>
      <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:top;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:32px;vertical-align:top;padding-top:2px;">
              <div style="width:28px;height:28px;border-radius:50%;background:rgba(0,168,204,0.2);border:1px solid rgba(0,168,204,0.4);text-align:center;line-height:28px;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;color:#00a8cc;">${i + 1}</div>
            </td>
            <td style="padding-left:14px;">
              <div style="font-size:15px;font-weight:700;color:white;margin-bottom:4px;">${r.title}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.55;">${r.desc}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  const gpg    = system.hardness?.max_gpg ?? '—';
  const sysName = system.name || `ZIP ${zip}`;
  const vCount  = violations?.length || 0;
  const vHealth = violations?.filter(v => v.is_health_based)?.length || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Water Quality Report — Imperial Water Co.</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);">

        <!-- ── Header ── -->
        <tr>
          <td style="background:#0d2c47;padding:32px 40px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px;">Imperial Water Co.</div>
            <div style="font-size:26px;font-weight:700;color:white;line-height:1.2;">Your Water Quality Report</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.55);margin-top:6px;">${sysName} · ZIP ${zip}</div>
          </td>
        </tr>

        <!-- ── Water Score ── -->
        <tr>
          <td style="background:white;padding:32px 40px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:16px;">Water Quality Score</div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;width:100px;">
                  <div style="font-size:60px;font-weight:700;color:${scoreColor};line-height:1;">${score}</div>
                  <div style="font-size:14px;color:#9ca3af;margin-top:-4px;">/100</div>
                </td>
                <td style="vertical-align:middle;padding-left:24px;">
                  <div style="height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin-bottom:10px;">
                    <div style="height:100%;width:${score}%;background:${scoreColor};border-radius:5px;"></div>
                  </div>
                  <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">📍 Your score: ${score} &nbsp;·&nbsp; 🇺🇸 National avg: 62 &nbsp;·&nbsp; ✅ Goal: 85+</div>
                  <div style="font-size:13px;font-weight:700;color:${scoreColor};">${verdict} — treatment recommended</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Contaminants ── -->
        <tr>
          <td style="background:white;padding:28px 40px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Detected Contaminants</div>
            <div style="font-size:11px;color:#9ca3af;margin-bottom:16px;">EWG Tap Water Database 2013–2023</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${contaminantRows}
            </table>
          </td>
        </tr>

        <!-- ── Hardness + Violations ── -->
        <tr>
          <td style="background:white;padding:24px 40px;border-bottom:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;width:50%;padding-right:20px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Water Hardness</div>
                  <div style="font-size:40px;font-weight:700;color:#0d2c47;line-height:1;">${gpg}<span style="font-size:18px;color:#9ca3af;"> GPG</span></div>
                  <div style="font-size:13px;color:#6b7280;margin-top:4px;">${system.hardness?.label || '—'}</div>
                </td>
                <td style="vertical-align:top;padding-left:20px;border-left:1px solid #e5e7eb;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">EPA Violations on Record</div>
                  <div style="font-size:40px;font-weight:700;color:${vCount > 0 ? '#dc2626' : '#16a34a'};line-height:1;">${vCount}</div>
                  <div style="font-size:13px;color:#6b7280;margin-top:4px;">${vCount === 0 ? 'Clean record' : `${vHealth} health-based · ${vCount - vHealth} monitoring`}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Kurt's Assessment ── -->
        <tr>
          <td style="background:#0d2c47;padding:32px 40px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#00a8cc;margin-bottom:4px;">Kurt's Assessment</div>
            <div style="font-size:18px;font-weight:600;color:white;margin-bottom:24px;line-height:1.4;">Here's what I'd recommend for your home — in priority order.</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.07);border-radius:10px;overflow:hidden;">
              ${recsHTML}
            </table>
          </td>
        </tr>

        <!-- ── Why Imperial Water ── -->
        <tr>
          <td style="background:#1a3d5c;padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:16px;width:50%;">
                  <div style="font-size:13px;font-weight:600;color:white;margin-bottom:4px;">📍 We know ${areaShort} water</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">We've seen these exact contaminant profiles across ${localRegion}. No guessing.</div>
                </td>
                <td style="vertical-align:top;padding-left:16px;width:50%;">
                  <div style="font-size:13px;font-weight:600;color:white;margin-bottom:4px;">📞 You get Kurt — not a call center</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">When you call, I answer. When something needs adjusting, I come back.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── CTA ── -->
        <tr>
          <td style="background:#0d2c47;padding:32px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:16px;font-weight:600;color:white;margin-bottom:6px;">Ready to fix your water?</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.55);margin-bottom:24px;">No obligation. Just a straight conversation about what your home needs.</div>
            <a href="tel:+17138221308" style="display:inline-block;background:#1a6fa8;color:white;font-family:'Helvetica Neue',sans-serif;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;">
              Call or Text Kurt — (713) 822-1308
            </a>
            <div style="margin-top:24px;font-size:12px;color:rgba(255,255,255,0.35);">
              Imperial Water Co. · Sugar Land, TX ·
              <a href="https://imperialwaterco.com" style="color:rgba(255,255,255,0.35);text-decoration:underline;">imperialwaterco.com</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { email, zip } = body || {};

  if (!email || !zip) {
    return res.status(400).json({ error: 'email and zip are required' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SHEET_HOOK = process.env.SHEET_WEBHOOK_URL;

  // ── 0. Fetch water data fresh from the API (server-side) ──────────────────
  // We re-fetch rather than trusting browser-sent reportData to avoid any
  // client-side serialization issues and keep email data authoritative.
  let reportData = {};
  try {
    const proto   = req.headers['x-forwarded-proto'] || 'https';
    const host    = req.headers.host || 'imperialwaterco.com';
    const waterRes = await fetch(`${proto}://${host}/api/water-report?zip=${zip}`);
    if (waterRes.ok) {
      reportData = await waterRes.json();
    }
    console.log('send-report: zip=', zip, 'email=', email,
      'contaminants=', (reportData.contaminants || []).length);
  } catch (err) {
    console.error('Water data fetch error:', err.message);
  }

  // ── 1. Send email via Resend ──────────────────────────────────────────────
  let emailSent = false;
  if (RESEND_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:     'Imperial Water Co. <reports@chriskelley.io>',
          reply_to: ['kurt@imperialwaterco.com'],
          to:       [email],
          subject:  `Your Water Quality Report — ZIP ${zip}`,
          html:    buildEmailHTML(zip, reportData),
        }),
      });
      const resBody = await r.text();
      emailSent = r.ok;
      console.log('Resend status:', r.status, 'body:', resBody);
    } catch (err) {
      console.error('Resend exception:', err.message);
    }
  } else {
    console.warn('RESEND_API_KEY not set — email not sent');
  }

  // ── 2. Log to Google Sheet ────────────────────────────────────────────────
  if (SHEET_HOOK) {
    try {
      const sys = reportData.system || {};
      const aboveCount = (reportData.contaminants || []).filter(c => (c.times_over_guideline || 0) >= 1).length;
      await fetch(SHEET_HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip,
          email,
          area:                sys.area    || '',
          source:              sys.source  || '',
          hardness_gpg:        sys.hardness?.max_gpg || '',
          contaminants_flagged: aboveCount,
          source_page:         'water-report',
        }),
      });
    } catch (err) {
      console.error('Sheet webhook error:', err);
    }
  }

  return res.status(200).json({ success: true, emailSent });
}
