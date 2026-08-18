# Agent Note: Web UI 共享密钥访问门

Status: implemented

[English](2026-08-18-web-access-gate.md) | 中文

## 问题

Web UI 的 HTTP 载体没有认证。`dsh web --host 0.0.0.0` 被拒绝，因为全接口绑定会把远程代码执行（`session.prompt` 驱动 bash）暴露给任何能打开该源的主机。因此通过公网用手机访问没有受支持的路径：`/api` 的 Host 栅栏是混淆代理人防御（[浏览器信任边界](../architecture/2026-07-28-api-browser-trust-boundary.md)），不是登录，而特权方法仍只限回环。

## 决策

**由组合应用在 `ctx.webServer` 上注册的请求守卫持有共享密钥；CLI 仅在该密钥存在且足够长时允许 `--host 0.0.0.0`。**

- `WebServer.registerGuard` 在具名路由、回退席位和 upgrade 分发之前运行。`handled` 完成这次交换；省略 `upgrade` 则不拦截 upgrade。该表受 effect 作用域约束。
- `@deepseek-ai/dsh-host-access-gate` 是随附的守卫。去除空白后为空的 `secret` 不安装任何东西（回环上的 `dsh web` 不变）。非空但短于 16 个字符的密钥会在加载时失败。绑定 `0.0.0.0` 且密钥为空同样会在加载时失败。Web 组合包从 `DSH_ACCESS_SECRET` 读取 `secret`。
- 未认证的 HTML GET/HEAD 收到无需 JavaScript 的中文登录页。该文档强制 `color-scheme: light`，并为密码框设置 `color`、背景、`-webkit-text-fill-color` 与 `caret-color`，避免系统深色主题把已输入的圆点藏掉；`font-size: 16px` 避免 iOS 放大输入框。`POST /__dsh/access` 接受表单 `secret=` 或 JSON `{secret}`，并设置 HttpOnly 的 `dsh_access` HMAC cookie（`SameSite=Lax`、`Path=/`、`Max-Age`=`ttlSeconds`，在 HTTPS 或 `X-Forwarded-Proto` 以 `https` 开头时带 `Secure`）。未认证的 `/api` 以及其他非 GET/HEAD 返回 401。未认证的 upgrade 会被拒绝。失败登录按 `socket.remoteAddress` 限制为每 60 秒五次。
- cookie 存储过期时间加 HMAC，不存储密钥。这不是用户账户系统：任何知道密钥的人都是同一主体。TLS 终止仍由反向代理负责。特权 `/api` 方法仍只限回环。

## 曾考虑的替代方案

**HTTP Basic 认证。** 不予采纳：每个请求都会携带密钥，没有专门的手机登录页，而且浏览器缓存 Basic 凭据的方式不是本产品想拥有的。

**把局域网当作可信网络并省略密钥。** 不予采纳：公网上的手机不是可信局域网，而 `session.prompt` 就是远程代码执行。

**操作者账户或 SSO。** 超出范围：harness 没有雇员身份；匿名 `$DSH_HOME` 不是账户存储。

**只拦截 `/api`。** 不予采纳：未认证的 SPA 字节和 upgrade 仍会泄漏会话 UI 与事件流；拦截器必须坐在 HTTP 载体上。

## 后果

手机可以打开公网源、输入密钥，然后使用普通会话 UI，包括 `session.prompt`。设置、凭据、原生 pick/open 以及 agent-preset 创作仍只限回环。没有 TLS 反向代理的公网绑定会在线路上泄漏密钥和 cookie。守卫在 `apply` 中、webserver 已经监听之后才注册，因此启动窗口内的请求可能错过该门。Host 栅栏与访问门仍然分开：公网 Host 除了 cookie 之外仍需要 `--trusted-host`（或推导的 LAN IP）。

交叉链接：[显式指定 Web 绑定地址](./2026-07-22-web-bind-address.md)，[api 浏览器信任边界](../architecture/2026-07-28-api-browser-trust-boundary.md)。
