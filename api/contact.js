// Vercel Serverless Function — POST /api/contact
// Receives quote request form submissions and notifies Kurt via email.

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildNotificationEmail({ firstName, lastName, phone, email, service, city, address, plan, message, sourcePage }) {
  const name       = [firstName, lastName].filter(Boolean).join(' ') || '(no name)';
  const firstName_ = firstName || name;
  const dialPhone  = (phone || '').replace(/\D/g, '');
  const isMaint    = sourcePage === 'maintenance-form';
  const title      = isMaint ? 'Maintenance Plan Request' : 'New Quote Request';
  const subtitle   = isMaint
    ? (plan ? esc(plan) : 'Plan not specified')
    : ((city ? esc(city) + ' · ' : '') + (service ? esc(service) : 'Service not specified'));

  const PLAN_LABELS = {
    'annual':      'Annual Plan (1 visit/yr)',
    'semi-annual': 'Semi-Annual Plan (2 visits/yr)',
    'unsure':      'Not sure yet',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — Imperial Water Co.</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#0d2c47;padding:28px 36px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:4px;">Imperial Water Co.</div>
            <div style="font-size:22px;font-weight:700;color:white;line-height:1.3;">${title}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.50);margin-top:4px;">${subtitle}</div>
          </td>
        </tr>

        <!-- Contact Details -->
        <tr>
          <td style="background:white;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td style="padding-bottom:18px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Name</div>
                  <div style="font-size:18px;font-weight:700;color:#111827;">${esc(name)}</div>
                </td>
              </tr>

              ${phone ? `<tr>
                <td style="padding-bottom:18px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Phone</div>
                  <div style="font-size:16px;color:#111827;"><a href="tel:${esc(dialPhone)}" style="color:#1a6fa8;text-decoration:none;font-weight:600;">${esc(phone)}</a></div>
                </td>
              </tr>` : ''}

              ${email ? `<tr>
                <td style="padding-bottom:18px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Email</div>
                  <div style="font-size:16px;color:#111827;"><a href="mailto:${esc(email)}" style="color:#1a6fa8;text-decoration:none;">${esc(email)}</a></div>
                </td>
              </tr>` : ''}

              ${address ? `<tr>
                <td style="padding-bottom:18px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Address</div>
                  <div style="font-size:16px;color:#374151;">${esc(address)}</div>
                </td>
              </tr>` : ''}

              ${plan ? `<tr>
                <td style="padding-bottom:18px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Plan Requested</div>
                  <div style="font-size:16px;font-weight:600;color:#0d2c47;">${esc(PLAN_LABELS[plan] || plan)}</div>
                </td>
              </tr>` : ''}

              ${!plan && service ? `<tr>
                <td style="padding-bottom:${city || message ? '18px' : '0'};">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Service Requested</div>
                  <div style="font-size:16px;font-weight:600;color:#0d2c47;">${esc(service)}</div>
                </td>
              </tr>` : ''}

              ${city ? `<tr>
                <td style="padding-bottom:${message ? '18px' : '0'};">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">City</div>
                  <div style="font-size:16px;color:#374151;">${esc(city)}</div>
                </td>
              </tr>` : ''}

              ${message ? `<tr>
                <td>
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">${isMaint ? 'Current Water System' : 'Notes from Customer'}</div>
                  <div style="font-size:14px;color:#374151;line-height:1.65;background:#f9fafb;border-radius:8px;padding:14px 16px;border:1px solid #e5e7eb;">${esc(message)}</div>
                </td>
              </tr>` : ''}

            </table>
          </td>
        </tr>

        <!-- Action Buttons -->
        <tr>
          <td style="background:#0d2c47;padding:24px 36px;text-align:center;">
            ${phone ? `<a href="tel:${esc(dialPhone)}" style="display:inline-block;background:#1a6fa8;color:white;font-family:'Helvetica Neue',sans-serif;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin:4px;">📞 Call ${esc(firstName_)}</a>` : ''}
            ${email ? `<a href="mailto:${esc(email)}" style="display:inline-block;background:rgba(255,255,255,0.12);color:white;font-family:'Helvetica Neue',sans-serif;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin:4px;">✉️ Reply by Email</a>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0d2c47;padding:14px 36px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.30);">Imperial Water Co. · <a href="https://imperialwaterco.com" style="color:rgba(255,255,255,0.30);text-decoration:underline;">imperialwaterco.com</a></div>
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

  const { firstName, lastName, phone, email, service, city, address, plan, message, sourcePage } = body || {};

  if (!firstName) {
    return res.status(400).json({ error: 'First name is required' });
  }
  if (!phone && !email) {
    return res.status(400).json({ error: 'Phone or email is required' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SHEET_HOOK = process.env.SHEET_WEBHOOK_URL;

  const name     = [firstName, lastName].filter(Boolean).join(' ');
  const isMaint  = sourcePage === 'maintenance-form';
  const subjTag  = isMaint ? 'Maintenance Plan' : 'Quote Request';
  const subjLoc  = address || city || '';

  console.log('contact: name=', name, 'phone=', phone, 'email=', email,
    'service=', service, 'plan=', plan, 'city=', city, 'source=', sourcePage);

  // ── 1. Send notification email to Kurt ─────────────────────────────────────
  let emailSent = false;
  if (RESEND_KEY) {
    try {
      const payload = {
        from:    'Imperial Water Co. <reports@chriskelley.io>',
        to:      ['kurt@imperialwaterco.com', 'Imperial.water.company@gmail.com', 'chris@chriskelley.io'],
        subject: `New ${subjTag} — ${name}${subjLoc ? ' · ' + subjLoc : ''}`,
        html:    buildNotificationEmail({ firstName, lastName, phone, email, service, city, address, plan, message, sourcePage }),
      };
      // Set reply-to as the customer so Kurt can reply directly to them
      if (email) {
        payload.reply_to = [email];
      }

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.text();
      emailSent = r.ok;
      console.log('contact: Resend status:', r.status, resBody);
    } catch (err) {
      console.error('contact: Resend exception:', err.message);
    }
  } else {
    console.warn('RESEND_API_KEY not set — contact notification not sent');
  }

  // ── 2. Log to Google Sheet (optional) ────────────────────────────────────
  if (SHEET_HOOK) {
    try {
      await fetch(SHEET_HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone:       phone      || '',
          email:       email      || '',
          service:     plan || service || '',
          city:        city       || '',
          address:     address    || '',
          message:     message    || '',
          source_page: sourcePage || 'contact-form',
        }),
      });
    } catch (err) {
      console.error('contact: Sheet webhook error:', err);
    }
  }

  return res.status(200).json({ success: true, emailSent });
}
