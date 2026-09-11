# Bland AI Skills (deprecated)

This repository is retired and no longer maintained. Use the official Bland plugin and the Bland CLI instead. Everything this plugin did is available there:

| You used | Use instead |
|---|---|
| The `bland` plugin from this marketplace (`bland@bland-skills`) | The Bland plugin, [`CINTELLILABS/bland-plugins`](https://github.com/CINTELLILABS/bland-plugins) (`bland@bland`) |
| The `create-call`, `monitor-call`, and `live-listen` skills | The plugin's `calls` skill |
| The `send-sms` skill | The plugin's `messaging` skill |
| The `setup-api-key`, `personas`, and `knowledge-base` skills | The plugin's `setup`, `persona`, and `knowledge` skills |
| The stdio MCP server and its `bland_*` tools, including `bland_auth_login` | `npx -y bland-cli mcp`, which has every tool this server had and more |
| `bin/bland-play.sh`, `bin/bland-poll.sh` | `bland call recording`, `bland call send --wait` |
| `bin/bland-listen.sh`, `bin/bland-monitor.sh` | The plugin's `calls` skill, which gives the live audio and active-call stream commands |

## Switch to the Bland plugin

In Claude Code, remove this marketplace, which also uninstalls its plugin, then install the official one:

```text
/plugin marketplace remove bland-plugin
/plugin marketplace add CINTELLILABS/bland-plugins
/plugin install bland@bland
```

`bland-plugin` is the name this repository's marketplace registers under. If the remove command can't find it, run `/plugin marketplace list` to see the name on your machine.

The install asks for your Bland API key. Get one at [app.bland.ai/settings/api-keys](https://app.bland.ai/settings/api-keys). For Cursor, Codex, and Claude Desktop, follow the [Bland plugin install guide](https://github.com/CINTELLILABS/bland-plugins#install).

## Use the MCP server without the plugin

Any MCP client that runs a local (stdio) server can use the Bland CLI's server:

```bash
npx -y bland-cli mcp
```

Without a `BLAND_API_KEY` in the environment, ask the agent to log in to Bland. It runs the same browser sign-in flow this plugin's `bland_auth_login` tool did.
