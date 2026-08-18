function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Self-contained Chinese login HTML. No JavaScript — a phone browser must
 * submit the form with a native POST. Input color, fill, and caret are
 * explicit so a dark OS theme cannot hide typed password bullets.
 *
 * @param error Optional message shown above the field.
 * @returns Complete HTML document.
 */
export function renderLoginPage(error?: string): string {
  const errorHtml =
    error === undefined
      ? ''
      : `<p class="error" role="alert">${escapeHtml(error)}</p>`
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>DeepSeek Harness</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      height: 100%;
      color-scheme: light;
      -webkit-text-size-adjust: 100%;
    }
    body {
      min-height: 100%;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
        "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
    }
    main {
      width: min(400px, 100%);
      background: #ffffff;
      border-radius: 22px;
      padding: 44px 32px 32px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.06);
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
      color: #6e6e73;
      font-weight: 400;
    }
    .error {
      margin-top: 16px;
      font-size: 14px;
      line-height: 1.4;
      color: #b3261e;
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
      background: #f5f5f7;
      color: #1d1d1f;
      -webkit-text-fill-color: #1d1d1f;
      caret-color: #0071e3;
      font: inherit;
      font-size: 16px;
      line-height: 48px;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      opacity: 1;
    }
    input[type="password"]::placeholder {
      color: #86868b;
      -webkit-text-fill-color: #86868b;
      opacity: 1;
    }
    input[type="password"]:focus {
      background: #ffffff;
      box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.18), 0 0 0 1px #0071e3;
    }
    button {
      display: block;
      width: 100%;
      height: 48px;
      margin-top: 16px;
      border: 0;
      border-radius: 12px;
      background: #0071e3;
      color: #ffffff;
      font: inherit;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      -webkit-appearance: none;
    }
    button:active { background: #0077ed; }
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
