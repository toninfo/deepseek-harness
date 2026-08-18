# Use the Web UI

English | [中文](index.zh.md)

Start the Web UI through the [root README](../../../README.md#run); the command prints its URL. This guide begins after that server is running. The `dsh` process uses its invoking directory as the default filesystem location, but a fresh Web UI has no selected workspace until you add one.

## Configure a model

Open **Settings → Models**, enter a [DeepSeek API key](https://platform.deepseek.com/), and save it. The model route becomes usable immediately without restarting the server.

The [model configuration guide](./providers.md) covers other providers and custom OpenAI-compatible endpoints.

## Choose a workspace

Click **Choose workspace**, add the project directory where you started `dsh`, and select it. The session composer remains unavailable until a workspace is selected.

## Run a task

Start a session and send:

> Summarize this repository and identify its main packages.

The agent can read and edit workspace files, run commands, delegate work, and maintain a plan. The Web UI asks before operations that require approval under the active permission policy.

## Open the UI from another device

Set `DSH_ACCESS_SECRET` to at least 16 characters, bind all interfaces, and name the public Host the phone will send:

```sh
# PowerShell
$env:DSH_ACCESS_SECRET = "<secret>"
pnpm dsh web --host 0.0.0.0 --port 3080 --trusted-host <public-host-or-ip>
```

Open that origin on the phone, enter the secret, and the ordinary session UI loads. Put a TLS reverse proxy in front of any internet bind; this server does not terminate HTTPS. Privileged host actions (Settings, credentials, native folder pick) remain loopback-only.

## Continue

- [Configure models](./providers.md)
- [Use the Python SDK](./python-sdk.md)
- [Use other CLI modes](../../../apps/cli/README.md)
- [Develop a plugin](../develop/basic/)
