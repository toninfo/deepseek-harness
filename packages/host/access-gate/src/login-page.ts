function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Appearance preference the login page can paint without JavaScript. */
export type LoginTheme = 'light' | 'dark' | 'system'

/**
 * Narrow a settings or caller value to a login-page theme.
 * @param preference - `ui-theme.preference` or any other wire value.
 * @returns a built-in theme; unknown values follow the system palette.
 */
export function resolveLoginTheme(preference: unknown): LoginTheme {
  return preference === 'light' || preference === 'dark' || preference === 'system'
    ? preference
    : 'system'
}

const DARK_VARS = `
      --page: #151517;
      --card: #232324;
      --text: #f5f5f7;
      --muted: #a1a1a6;
      --field: #2c2c2e;
      --field-focus: #3a3a3c;
      --placeholder: #86868b;
      --error: #ff453a;
      --accent: #0a84ff;
      --accent-active: #409cff;
      --on-accent: #ffffff;
      --caret: #0a84ff;
      --focus: rgba(10, 132, 255, 0.32);
      --shadow: 0 2px 8px rgba(0, 0, 0, 0.32), 0 12px 40px rgba(0, 0, 0, 0.4);
      color-scheme: dark;`

/**
 * Self-contained Chinese login HTML. No JavaScript — a phone browser must
 * submit the form with a native POST. Palettes are explicit in both light
 * and dark so typed password bullets stay visible. `system` follows
 * `prefers-color-scheme`; `light`/`dark` match the Appearance setting.
 * A 560px breakpoint drops the desktop card chrome, matching other Web forms.
 *
 * @param error Optional message shown above the field.
 * @param theme Appearance preference; defaults to `system`.
 * @returns Complete HTML document.
 */
export function renderLoginPage(error?: string, theme: LoginTheme = 'system'): string {
  const errorHtml =
    error === undefined
      ? ''
      : `<p class="error" role="alert">${escapeHtml(error)}</p>`
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>DeepSeek Harness</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --page: #f5f5f7;
      --card: #ffffff;
      --text: #1d1d1f;
      --muted: #6e6e73;
      --field: #f5f5f7;
      --field-focus: #ffffff;
      --placeholder: #86868b;
      --error: #b3261e;
      --accent: #0071e3;
      --accent-active: #0077ed;
      --on-accent: #ffffff;
      --caret: #0071e3;
      --focus: rgba(0, 113, 227, 0.18);
      --shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.06);
      color-scheme: light;
    }
    :root[data-theme="dark"] { ${DARK_VARS} }
    @media (prefers-color-scheme: dark) {
      :root[data-theme="system"] { ${DARK_VARS} }
    }
    html {
      height: 100%;
      -webkit-text-size-adjust: 100%;
    }
    body {
      min-height: 100%;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding:
        max(24px, env(safe-area-inset-top))
        max(24px, env(safe-area-inset-right))
        max(24px, env(safe-area-inset-bottom))
        max(24px, env(safe-area-inset-left));
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
        "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      background: var(--page);
      color: var(--text);
    }
    main {
      width: min(420px, 100%);
      background: var(--card);
      border-radius: 22px;
      padding: 44px 32px 32px;
      box-shadow: var(--shadow);
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.022em;
      line-height: 1.15;
    }
    .lead {
      margin-top: 8px;
      font-size: 17px;
      line-height: 1.4;
      color: var(--muted);
      font-weight: 400;
    }
    .error {
      margin-top: 16px;
      font-size: 14px;
      line-height: 1.4;
      color: var(--error);
    }
    label { display: block; margin-top: 28px; }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    input[type="password"] {
      display: block;
      width: 100%;
      height: 48px;
      padding: 0 16px;
      border: 0;
      border-radius: 12px;
      background: var(--field);
      color: var(--text);
      -webkit-text-fill-color: var(--text);
      caret-color: var(--caret);
      font: inherit;
      font-size: 16px;
      line-height: 1.25;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      opacity: 1;
    }
    input[type="password"]::placeholder {
      color: var(--placeholder);
      -webkit-text-fill-color: var(--placeholder);
      opacity: 1;
    }
    input[type="password"]:focus {
      background: var(--field-focus);
      box-shadow: 0 0 0 4px var(--focus), 0 0 0 1px var(--accent);
    }
    button {
      display: block;
      width: 100%;
      height: 48px;
      margin-top: 16px;
      border: 0;
      border-radius: 12px;
      background: var(--accent);
      color: var(--on-accent);
      font: inherit;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      -webkit-appearance: none;
    }
    button:active { background: var(--accent-active); }
    @media (hover: hover) and (pointer: fine) {
      button:hover { background: var(--accent-active); }
    }
    @media (max-width: 560px) {
      body {
        align-items: stretch;
        padding:
          max(16px, env(safe-area-inset-top))
          max(16px, env(safe-area-inset-right))
          max(16px, env(safe-area-inset-bottom))
          max(16px, env(safe-area-inset-left));
      }
      main {
        width: 100%;
        max-width: 420px;
        margin-block: auto;
        background: transparent;
        border-radius: 0;
        box-shadow: none;
        padding: 28px 4px 16px;
      }
      h1 { font-size: 24px; }
      .lead { font-size: 16px; }
    }
    @media (max-height: 500px) {
      body { align-items: flex-start; }
      main { margin-block: 0; }
    }
  </style>
</head>
<body>
  <main>
    <form method="post" action="/__dsh/access" autocomplete="on">
      <h1>DeepSeek Harness</h1>
      <p class="lead">请输入访问密钥以继续。</p>
      ${errorHtml}
      <label>
        <span class="sr">访问密钥</span>
        <input type="password" name="secret" autocomplete="current-password"
          autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="访问密钥" required autofocus>
      </label>
      <button type="submit">继续</button>
    </form>
  </main>
</body>
</html>
`
}
