# Agent Note: 非安全上下文上的浏览器 RPC id

Status: implemented

[English](2026-08-18-insecure-origin-rpc-id.md) | 中文

## 问题

`AbstractApiClient.mintRpcId` 调用了 `crypto.randomUUID()`。该方法是安全上下文 Web API：浏览器在 `https:` 以及 `http://localhost` / `http://127.0.0.1` 上提供它，在其它 `http:` 源上则省略或抛错。因此局域网 IP（`http://192.168.2.4:3080`）或未启用 TLS 的具名 Host 会在任何 `/api` POST 离开浏览器之前抛出 `crypto.randomUUID is not a function`。模型设置页把它显示为提供方目录加载失败；使用同一 API 的工作区列表、会话 RPC 以及草稿图片 id 会以同样方式失败。通用 connection RPC 已经通过 `getRandomValues()` 签发；UI 实际调用的 `IApiClient` 面没有。

## 决策

**fetch 载体客户端用 `crypto.getRandomValues()` 签发每一枚客户端发起的 rpcId；浏览器在非安全的 HTTP 源上也会暴露该 API。**

`packages/host/apiproxy/src/fetch/random-uuid.ts` 生成 RFC 4122 第 4 版 UUID。`AbstractApiClient.mintRpcId` 与 connection 包里已有的辅助函数都使用它。Composer 草稿附件 id 以及 `createMessage` 在没有 `crypto.randomUUID` 时使用 `getRandomValues`。Host 提供的是每个插件已构建的 `/plugins/<id>/client.js`；只改源码不会到达局域网浏览器，必须重建该 bundle。

这不改变 Host 栅栏或特权方法钉扎。设置、凭据、原生 `host.pickDirectory` / `host.openPath`、`llm.discoverModels` 以及 agent-preset 创作仍只限回环（[访问门](../feature/2026-08-18-web-access-gate.md)）。全接口绑定仍挂载应用内浏览选择器（`host.listDirectory`），该方法不在该集合中。

## 曾考虑的替代方案

**在任何 `/api` 调用之前要求 HTTPS（或 localhost）。** 不予采纳：`dsh web --host 0.0.0.0` 以及未启用 TLS 的具名 Host 是受支持的部署形态；访问门已经认证这些源。强制 TLS 会把 UUID 抛错变成“缺少反向代理”的产品错误。

**在 `window.crypto` 上安装 `crypto.randomUUID` 填充。** 不予采纳：签发只发生在载体的一处调用点；补丁平台对象会掩盖页面随后可能碰到的其它非安全上下文 API。

**只覆盖 `WebApiClient.mintRpcId`。** 不予采纳：rpcId 签发是 `AbstractApiClient` 拥有的协议不变量；进程内或未来的浏览器子类会继续抛错。

## 后果

手机或局域网浏览器在 `http://<lan-ip>` 或 `http://<trusted-host>` 上可以签发 rpcId，并使用会话 UI、工作区浏览和 `llm.providers`。从该源打开设置 → 模型仍会在特权钉扎处失败（`settings.describe` 只限回环）；请在 `http://127.0.0.1:3080` 配置提供方和 API 密钥。公网 HTTP 绑定仍会泄漏访问门密钥和 cookie。

交叉链接：[Web 访问门](../feature/2026-08-18-web-access-gate.md)，[api 浏览器信任边界](../architecture/2026-07-28-api-browser-trust-boundary.md)。
