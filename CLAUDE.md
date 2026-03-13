# Bland AI Skills

These skills teach you how to use the Bland AI voice agent API to make phone calls, manage call lifecycle, stream live transcripts, and play recordings.

## Authentication
All Bland API requests use the `authorization` header with a raw API key (NOT Bearer-prefixed):
```
authorization: org_your_api_key_here
```
The API key should be stored in `$BLAND_API_KEY` environment variable.

**Base URL**: `https://api.bland.ai`

## Key Endpoints

### Calls
- `POST /v1/calls` — Create outbound voice call
- `GET /v1/calls/:call_id` — Get call details, transcript, recording URL
- `GET /v1/calls?limit=N` — List recent calls
- `GET /v1/calls/active` — List all currently active calls
- `GET /v1/calls/active/stream` — SSE stream of all active call status updates
- `GET /v1/calls/:call_id/transcript/stream` — SSE stream of live transcript for a call
- `POST /v1/calls/:call_id/stop` — Stop an in-progress call
- `POST /v1/calls/active/stop` — Stop all active calls
- `POST /v1/calls/:call_id/listen` — Get WSS URL for live audio
- `POST /v1/calls/:call_id/analyze` — Run post-call analysis
- `GET /v1/recordings/:id` — Stream call recording audio

### Knowledge Bases
- `POST /v1/knowledge/learn` — Create KB from file upload, text, or web scrape
- `GET /v1/knowledge` — List all knowledge bases (paginated)
- `GET /v1/knowledge/:kb_id` — Get KB details and status
- `PUT /v1/knowledge/:kb_id` — Update KB name/description
- `DELETE /v1/knowledge/:kb_id` — Soft-delete a knowledge base

## Helper Scripts
Shell scripts in `bin/` handle operations that require more than curl:
- `bin/bland-monitor.sh` — Connect to active calls SSE stream, log events
- `bin/bland-poll.sh <call_id>` — Poll until call completes (fallback)
- `bin/bland-play.sh <call_id>` — Download and play call recording
- `bin/bland-listen.sh <call_id>` — Live listen to in-progress call audio

## Common Patterns
- **Single call**: Create → monitor via SSE or poll → get results → play recording
- **Multi-call**: Start SSE stream → dispatch N calls → monitor all → get results as each completes
- **Live transcript**: Connect to `/v1/calls/:id/transcript/stream` to see conversation in real-time
- **KB-powered call**: Upload file/text → poll until COMPLETED → create call with `"tools": ["kb_id"]` (KB IDs are prefixed with `KB-`)
