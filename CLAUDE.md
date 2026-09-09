# Bland AI Plugin

This plugin provides MCP tools and workflow skills for building voice AI agents with the Bland AI API.

## Architecture

- **MCP Server** (`dist/mcp-server.js`) — handles all Bland API calls. Auth and HTTP are managed by the server process; you never need curl or shell env setup.
- **Skills** (`skills/`) — teach workflows: when to use personas vs raw calls, how to monitor call lifecycle, how to manage knowledge bases. Skills reference MCP tool names.
- **Shell Scripts** (`bin/`) — handle operations requiring persistent connections (SSE streams, WebSocket audio) that can't go through MCP.

## Authentication

The MCP server resolves the API key automatically using layered fallback:

1. `BLAND_API_KEY` environment variable (recommended)
2. Bland CLI config (`~/.config/bland-cli-nodejs/config.json`) if the CLI is installed

No shell setup, no `source` commands, no env file loading needed. If the user hasn't set up auth yet, use the `setup-api-key` skill, or call `bland_auth_login` directly:

- **Device mode** (default): returns a code and link immediately. Tell the human to open the link and enter the code, then poll `bland_auth_poll` with the returned `device_code` until it reports `approved` or `expired`.
- **Browser mode** (opt in with `mode: "browser"`): opens a local browser and blocks until signup/login completes. Use it only when the agent has a local browser.

Leaving `mode` unset uses device mode under the MCP server, which always runs over piped stdio. When the tools are embedded in-process with the Agent SDK and run in an interactive terminal, unset falls back to browser mode, so pass `mode: "device"` there to be explicit.

## MCP Tools

All API operations go through MCP tools (prefixed `bland_`):

### Calls
- `bland_call_send` — Make outbound call (persona_id, task, or pathway_id)
- `bland_call_list` — List recent calls
- `bland_call_get` — Get call details, transcript, recording URL
- `bland_call_stop` — Stop an in-progress call
- `bland_call_stop_all` — Stop all active calls
- `bland_call_active` — List active calls

### Personas
- `bland_persona_list` — List all personas
- `bland_persona_get` — Get persona details
- `bland_persona_create` — Create persona
- `bland_persona_update` — Update draft version
- `bland_persona_delete` — Delete persona
- `bland_persona_promote` — Promote draft to production

### Knowledge Bases
- `bland_knowledge_list` — List knowledge bases
- `bland_knowledge_create` — Create KB from text or web URLs
- `bland_knowledge_get` — Get KB details and status
- `bland_knowledge_delete` — Delete KB

### Pathways
- `bland_pathway_list` — List pathways
- `bland_pathway_get` — Get pathway details
- `bland_pathway_create` — Create pathway
- `bland_pathway_chat` — Chat with pathway interactively
- `bland_pathway_node_test` — Test individual node

### Other
- `bland_number_list` — List phone numbers
- `bland_number_buy` — Purchase phone number
- `bland_voice_list` — List available voices
- `bland_tool_test` — Test custom tool
- `bland_sms_send` — Send SMS/WhatsApp (Enterprise)
- `bland_audio_generate` — Generate TTS audio

## Shell Scripts

For operations requiring persistent connections (SSE, WebSocket):
- `bin/bland-monitor.sh` — SSE stream of active call status updates
- `bin/bland-poll.sh <call_id>` — Poll until call completes
- `bin/bland-play.sh <call_id>` — Download and play recording
- `bin/bland-listen.sh <call_id>` — Live listen to call audio via WebSocket

These scripts read `BLAND_API_KEY` from the environment.

## Common Patterns

- **Persona call**: `bland_persona_list` → pick one → `bland_call_send` with persona_id + phone_number
- **Quick call**: `bland_call_send` with task + phone_number
- **Monitor**: `bland_call_get` to check status, or `bin/bland-monitor.sh` for real-time SSE
- **KB-powered call**: `bland_knowledge_create` → poll with `bland_knowledge_get` until COMPLETED → `bland_call_send` with tools array
- **Persona workflow**: `bland_persona_create` → `bland_persona_update` (edits draft) → `bland_persona_promote` (makes live)
- **SMS**: `bland_sms_send` with user_number + agent_number
