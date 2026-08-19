# Agent Note: 手机侧边栏抽屉与设置窄屏布局

Status: implemented

[English](2026-08-19-phone-sidebar-drawer-settings-narrow.md) | 中文

## Problem

手机宽度下，关闭的侧边栏仍占用 56px 控制栏，挤压对话区并裁切长标签。设置模态在 `max-width: calc(100vw - 48px)` 内并排保留 188px 侧栏导航，选项标题被挤成单字列，控件重叠。抽屉落地后，会话头仍压在左上角打开控件下，输入栏右侧模型名 + 力度也未像权限芯片那样在窄行收起。

## Decision

**低于 `SIDEBAR_PHONE`（560px）时，关闭的侧边栏占零网格宽度；AppFrame 在左上角提供打开控件，打开后以遮罩抽屉叠加显示。同一断点下，设置面板改为上方横向可滚动分区导航、下方内容区。会话外壳与输入工具行也在该宽度 / InputBar 的 460px 容器查询下收紧。**

- `computeColumns` 接受 `hideClosedSidebar`；手机上无论抽屉开闭，AppFrame 都向求解器传入关闭偏好，使网格轨道保持为 0。
- 平板宽度（`SIDEBAR_PHONE` … `SIDEBAR_AUTO_COLLAPSE`）仍使用既有自动收起控制栏与挤压展开行为。
- 手机打开控件与遮罩的 aria 文案为中文产品文案，由 frame 持有（该包无 locale seat）。
- 设置布局仅为 CSS（`@media (max-width: 560px)`）；分区内容插件不变。
- 会话头左侧留白避开打开控件；ModelSelect 通过 `@container` 隐藏力度并缩短芯片（与 PermissionSelect 共用 InputBar 行）；ContextMeter 面板按视口钳制；Hero 标题与输入侧边距略收。

## Alternatives considered

**手机上把打开的侧边栏挤进网格。** 否决：约 280px 偏好在约 390px 视口上会留下不可用的中间栏。

**保留 56px 控制栏，只在顶栏加切换。** 否决：空间占用本身就是问题；需要隐藏。

**由 ui-sidebar 向 `shell.overlay` 注册打开控件。** 本次否决：overlay 注册方无法在没有新跨插件接口的情况下读取 layout store 的收起覆盖状态；frame 已持有手机几何。

**聊天 Details 列的手机遮罩。** 延后：需要类似轨迹 Details 的 AppFrame / 中心列承载，超出外壳打磨范围。

## Consequences

手机上打开设置仍需先打开抽屉（触发器在侧边栏底部）。局域网 / 非回环上的 Settings 特权失败（`settings.describe` 403）仍是 Host 策略，不是布局缺陷。在 frame 获得 locale seat 之前，英文语言环境下手机打开/遮罩控件的 aria 仍为中文。手机上聊天 Details 仍会按桌面让步链自动收为零宽。

## Required verification

- `packages/client/ui-layout/tests/columns.client.spec.ts` — `hideClosedSidebar` 零宽度。
- `packages/client/ui-layout/tests/app-frame.client.spec.tsx` — 手机隐藏、抽屉打开、遮罩关闭。
- `pnpm run test:gui` 覆盖 ui-layout、ui-settings-general、ui-conversation 与 ui-model-selection。
