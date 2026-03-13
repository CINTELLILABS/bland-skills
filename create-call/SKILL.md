---
name: bland-create-call
description: >
  Create outbound voice calls via Bland AI. Handles call creation with phone number,
  task or pathway, voice, and optional parameters. Use when the user asks to make a
  phone call, schedule a call, or test a voice agent.
user-invocable: true
---

# Bland AI Call Creation

## Prerequisites

- `BLAND_API_KEY` environment variable must be set (see setup-api-key skill)
- `jq` must be installed for JSON parsing

## Before Making Any API Call

**Always check that `BLAND_API_KEY` is available** before attempting any Bland API request:

```bash
if [ -z "$BLAND_API_KEY" ]; then echo "NOT_SET"; else echo "SET"; fi
```

If `NOT_SET`, invoke the `setup-api-key` skill to get the key configured first.

If the key was saved to `/tmp/bland_env.sh` in a previous command, source it at the top of every Bash invocation (env vars don't persist between separate Bash tool calls):

```bash
source /tmp/bland_env.sh
```

**Critical**: Never copy-paste or retype the raw API key string into curl commands. Always reference `$BLAND_API_KEY`. API keys are long and error-prone to transcribe manually — even one wrong character causes auth failures.

## Create a Call

```bash
source /tmp/bland_env.sh
curl -s -X POST https://api.bland.ai/v1/calls \
  -H "authorization: $BLAND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+14155551234",
    "task": "You are a friendly assistant calling to book an appointment...",
    "voice": "mason",
    "record": true,
    "max_duration": 5
  }'
```

**Response**: `{ "status": "success", "call_id": "uuid-here" }`

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `phone_number` | string | E.164 format (e.g., `+14155551234`) |

### One of (required)

| Parameter | Type | Description |
|-----------|------|-------------|
| `task` | string | Free-form prompt describing agent behavior |
| `pathway_id` | string | UUID of a pre-built Conversational Pathway |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `voice` | string | Voice name (`mason`, `josh`, etc.) or UUID |
| `first_sentence` | string | Agent's opening line |
| `wait_for_greeting` | boolean | Wait for recipient to speak first |
| `record` | boolean | Record the call |
| `max_duration` | number | Max call length in minutes |
| `webhook` | string | Post-call webhook URL |
| `language` | string | Language code (`en`, `es`, etc.) |
| `tools` | string[] | IDs of knowledge bases and/or custom tools (e.g. `["kb_...", "TL-..."]`) |
| `transfer_phone_number` | string | Number to transfer to if needed |
| `interruption_threshold` | number | 0-255, lower = more interruptible |
| `model` | string | LLM model to use |
| `temperature` | number | LLM temperature 0-1 |
| `metadata` | object | Arbitrary JSON metadata |
| `request_data` | object | Variables accessible during the call |
| `from` | string | Caller ID configuration |
| `start_time` | string | Schedule call (min 5 min in advance) |

## After Call Creation — Ask the User

Once the call is successfully created and you have the `CALL_ID`, **immediately use `AskUserQuestion`** to ask the user how they want to follow the call. Do NOT automatically start polling or streaming.

Prompt with these three options:

| Option | Label | Description |
|--------|-------|-------------|
| 1 | **Listen to the call** | Stream live audio through your speakers in real-time |
| 2 | **Watch the transcript** | See the conversation as text in real-time |
| 3 | **Get a summary when done** | Wait for the call to finish, then show results |

### Option 1: Listen to the call

Invoke the `live-listen` skill or use the script directly:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/bland-listen.sh "$CALL_ID"
```

After listening ends, use the `call-management` skill to retrieve final results.

### Option 2: Watch the transcript

Connect to the transcript SSE endpoint:

```bash
curl -N -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/$CALL_ID/transcript/stream"
```

Parse and display each event as it arrives:
- `{"type":"new", "text":"...", "role":"assistant"|"user"}` — new utterance
- `{"type":"update", "text":"..."}` — corrected/updated text
- `{"type":"end"}` — call ended

When the `end` event arrives, use the `call-management` skill to retrieve final results.

### Option 3: Get a summary when done

Use the `call-management` skill to poll for completion and retrieve results:

```bash
RESULT=$(${CLAUDE_PLUGIN_ROOT}/bin/bland-poll.sh "$CALL_ID" 300)
echo "$RESULT" | jq '{status, call_length, concatenated_transcript, recording_url}'
```

## Attaching Knowledge Bases and Tools

The `tools` parameter accepts an array of string IDs — knowledge base IDs and/or custom tool IDs:

```json
{
  "phone_number": "+14155551234",
  "task": "You are a support agent. Answer questions using your knowledge base.",
  "tools": ["kb_01H8X9QK5R2N7P3M6Z8W4Y1V5T"],
  "record": true
}
```

Multiple tools and KBs can be combined:
```json
"tools": ["kb_01H8...", "TL-ba6c4237-..."]
```

**Important**: Knowledge bases must be in `COMPLETED` status before attaching. Use the `knowledge-base` skill to create and check KB status.

## Common Patterns

### Quick test call
```json
{
  "phone_number": "+1XXXXXXXXXX",
  "task": "Say hello and ask how the person is doing. Keep it brief.",
  "record": true,
  "max_duration": 1
}
```

### Appointment booking
```json
{
  "phone_number": "+1XXXXXXXXXX",
  "task": "You are calling to book an appointment for John Smith. Be polite and confirm date/time.",
  "first_sentence": "Hi, I'm calling on behalf of John Smith to schedule an appointment.",
  "record": true,
  "max_duration": 5
}
```

### Lead qualification
```json
{
  "phone_number": "+1XXXXXXXXXX",
  "task": "You are calling to qualify this lead for our SaaS product. Ask about their current solution, team size, budget, and timeline. Be conversational and friendly.",
  "record": true,
  "max_duration": 5,
  "metadata": {"lead_id": "lead_123"}
}
```

## Error Handling

- **401**: Invalid API key — check `$BLAND_API_KEY`
- **400**: Missing required fields or invalid phone number
- **429**: Rate limited — back off and retry after a few seconds
- **500**: Server error — retry after 5 seconds
