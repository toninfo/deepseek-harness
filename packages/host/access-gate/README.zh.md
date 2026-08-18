# `@deepseek-ai/dsh-host-access-gate`

[English](README.md) | 中文

Web UI 的共享密钥访问门：一个函数插件（配置为 `{secret, ttlSeconds}`），通过 [`webServer.registerGuard`](../webserver/README.md) 注册请求拦截器。去除首尾空白后为空的 `secret` 不安装任何东西，因此回环上的 `dsh web` 保持原样。非空但短于 16 个字符的密钥会在加载时失败。绑定 `0.0.0.0` 且密钥为空同样会在加载时失败。足够长的密钥会在未认证的 HTML GET/HEAD 上提供无需 JavaScript 的中文登录页。该页跟随 Host 外观偏好（`ui-theme.preference`：`light`、`dark` 或 `system`）；没有设置时使用 `system` 与 `prefers-color-scheme`，两套配色都为密码框指定 `color`、填充与光标色，使已输入的圆点保持可见。它处理 `POST /__dsh/access`（表单字段 `secret=` 或 JSON `{secret}`），设置 HttpOnly 的 `dsh_access` HMAC cookie（`SameSite=Lax`、`Path=/`、`Max-Age`=`ttlSeconds`，在 HTTPS 或 `X-Forwarded-Proto` 以 `https` 开头时带 `Secure`），对未认证的 `/api` 以及其他非 GET/HEAD 返回 401，并拒绝未认证的 HTTP upgrade。`POST /__dsh/access/logout` 清除 cookie。失败登录按 `socket.remoteAddress`（从不使用 `X-Forwarded-For`）限制为每 60 秒五次。随附的 Web 组合包从 `DSH_ACCESS_SECRET` 读取 `secret`。cookie 存储过期时间加 HMAC，不存储密钥本身；更换密钥会使尚未过期的 cookie 失效。

决策记录：[Web 访问门 Agent Note](../../../.agents/notes/implemented/feature/2026-08-18-web-access-gate.md)。

## 模型体验

无。该包在组装任何模型请求之前拦截浏览器 HTTP。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **共享密钥，不是操作者身份**：任何知道密钥的人都是同一主体；设置、凭据、原生 pick/open 以及 agent-preset 创作仍只限回环。
- **不提供 TLS**：对公网的明文 HTTP 会泄漏密钥和 cookie；应在前方放置 TLS 反向代理，并覆盖写入 `X-Forwarded-Proto`，而不是追加客户端提供的值。
- **守卫在 `apply` 中、监听之后才注册**：webserver 在激活时已经接受连接，因此启动窗口内的请求可能错过该门。
- **速率限制按直接 TCP 对端计**：反向代理会把所有客户端收成同一个桶。
