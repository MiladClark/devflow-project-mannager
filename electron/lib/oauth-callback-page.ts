/** Self-contained HTML for the OAuth loopback success/error page. */

export type OAuthCallbackPageKind = 'success' | 'error' | 'missing'

export function oauthCallbackHtml(kind: OAuthCallbackPageKind = 'success'): string {
  const copy =
    kind === 'success'
      ? {
          title: 'You’re signed in',
          body: 'Authorization completed successfully. You can close this tab and return to DevFlow Manager.',
          badge: 'Connected',
        }
      : kind === 'missing'
        ? {
            title: 'Something went wrong',
            body: 'No authorization code was received. Close this tab and try signing in again from DevFlow Manager.',
            badge: 'Incomplete',
          }
        : {
            title: 'Authorization failed',
            body: 'The sign-in response could not be verified. Close this tab and try again from DevFlow Manager.',
            badge: 'Failed',
          }

  const isOk = kind === 'success'
  const accent = isOk ? '#0e8fd6' : '#e11d48'
  const accentSoft = isOk ? 'rgba(14, 143, 214, 0.14)' : 'rgba(225, 29, 72, 0.12)'
  const icon =
    isOk
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DevFlow — ${copy.badge}</title>
  <style>
    :root {
      --bg: #d9e2f0;
      --panel: rgba(255, 255, 255, 0.72);
      --edge: rgba(24, 44, 82, 0.12);
      --text: #0f172a;
      --muted: #64748b;
      --accent: ${accent};
      --accent-soft: ${accentSoft};
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #070c18;
        --panel: rgba(30, 43, 71, 0.72);
        --edge: rgba(191, 213, 247, 0.16);
        --text: #f8fafc;
        --muted: #94a3b8;
      }
    }
    * { box-sizing: border-box; }
    html, body {
      height: 100%;
      margin: 0;
    }
    body {
      font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--text);
      background:
        radial-gradient(900px 520px at 12% 0%, rgba(76, 201, 255, 0.22), transparent 60%),
        radial-gradient(820px 480px at 92% 8%, rgba(139, 122, 255, 0.18), transparent 58%),
        radial-gradient(700px 420px at 50% 100%, rgba(45, 212, 191, 0.12), transparent 55%),
        var(--bg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: min(100%, 420px);
      background: var(--panel);
      border: 1px solid var(--edge);
      border-radius: 20px;
      padding: 36px 32px 32px;
      text-align: center;
      box-shadow:
        0 24px 48px -20px rgba(15, 23, 42, 0.28),
        0 0 0 1px rgba(255, 255, 255, 0.35) inset;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      animation: rise 0.45s cubic-bezier(0.33, 1, 0.68, 1) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 28px;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(165deg, #4cc9ff, #0e8fd6);
      display: grid;
      place-items: center;
      box-shadow: 0 8px 20px -8px rgba(14, 143, 214, 0.55);
    }
    .brand-mark svg { display: block; }
    .brand-name {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-name span {
      font-weight: 500;
      color: var(--muted);
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      margin: 0 auto 18px;
      border-radius: 18px;
      background: var(--accent-soft);
      border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
      display: grid;
      place-items: center;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.25;
    }
    p {
      margin: 0 auto;
      max-width: 32ch;
      font-size: 0.95rem;
      line-height: 1.55;
      color: var(--muted);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 22px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--accent);
      background: var(--accent-soft);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .hint {
      margin-top: 20px;
      font-size: 0.8rem;
      color: var(--muted);
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <main class="card" role="status">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="brand-name">DevFlow <span>Manager</span></div>
    </div>
    <div class="icon-wrap">${icon}</div>
    <h1>${copy.title}</h1>
    <p>${copy.body}</p>
    <div class="badge">${copy.badge}</div>
    <p class="hint">This window can be closed safely.</p>
  </main>
</body>
</html>`
}
