# Bland AI Skills

Voice agent skills for AI coding agents. Make phone calls, manage them, monitor in real-time, stream live transcripts, and play recordings — all from natural language.

## Quick Start


### 1. Add the Marketplace

In Claude Code:

```
/plugin marketplace add bland-ai/bland-skills
```

### 2. Install the Plugin

```
/plugin install bland@bland-skills
```

### 3. Set Your API Key

```bash
export BLAND_API_KEY="org_your_key_here"
```

Add to your `~/.zshrc` or `~/.bashrc` to persist across sessions.


### 4. Make a Call

Ask the agent:

> "Call +14155551234 and ask how the weather is. Keep it under 1 minute."

The agent will create a call, ask how you want to follow it (listen, watch transcript, or get a summary), and show you the results.


## Skills

| Skill | Description |
|-------|-------------|
| `setup-api-key` | Configure and validate your Bland AI API key |
| `create-call` | Create outbound voice calls with phone number, task/pathway, voice, and optional parameters |
| `call-management` | List calls, get details/status, stop calls, retrieve transcripts, play recordings, run analysis, monitor via SSE |
| `live-listen` | Stream call audio through your speakers in real-time via WebSocket |

## Shell Scripts

| Script | Description |
|--------|-------------|
| `bin/bland-monitor.sh [--raw]` | SSE stream monitor for all active calls (formatted or raw) |
| `bin/bland-poll.sh <call_id> [timeout]` | Poll until call completes with adaptive intervals |
| `bin/bland-play.sh <call_id> [--save file]` | Download and play call recording |
| `bin/bland-listen.sh <call_id>` | Live audio streaming via WebSocket |

## How Call Monitoring Works

**Primary: SSE Stream** — Connect once to `GET /v1/calls/active/stream` and get real-time updates for ALL your calls. Events: `QUEUED → IN_PROGRESS → TRANSFERRED → COMPLETE`.

**Fallback: Polling** — For simple one-off calls, poll `GET /v1/calls/:id` until `completed == true`.

**Live Transcript** — Connect to `GET /v1/calls/:id/transcript/stream` to see the conversation in real-time.

**Live Audio** — `POST /v1/calls/:id/listen` returns a WebSocket URL for streaming call audio to your speakers.
