---
name: bland-call-management
description: >
  Manage Bland AI voice calls: list calls, get call details, check status, stop calls,
  retrieve transcripts, play recordings, run post-call analysis, and monitor active calls
  via SSE stream. Use when the user wants to check on a call, list recent or active calls,
  stop a call, get a transcript, play a recording, or analyze call results.
user-invocable: true
---

# Bland AI Call Management

## Check Call Status

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>" \
  | jq '{status, completed, call_length, call_ended_by, answered_by}'
```

## Get Full Call Details

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>" | jq '{
    status,
    completed,
    call_length,
    call_ended_by,
    concatenated_transcript,
    recording_url,
    answered_by,
    analysis,
    variables
  }'
```

**Key response fields**:
- `completed` (boolean) — call has ended
- `status` — completed, failed, busy, no-answer
- `call_length` — duration in seconds
- `call_ended_by` — agent, customer, system
- `concatenated_transcript` — full transcript as string
- `transcripts` — array of `{text, user, created_at}`
- `recording_url` — URL to call recording
- `analysis` — post-call analysis results
- `variables` — variables set during call
- `answered_by` — human, voicemail, machine

## List Active Calls

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/active" | jq '.[] | {call_id, status, to, objective}'
```

## List Recent Calls

```bash
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls?limit=10" \
  | jq '.calls[] | {call_id: .c_id, status, to, created_at, call_length}'
```

## Get Transcript

```bash
# Structured transcript with speaker labels
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>" | jq '.transcripts'

# Plain text transcript
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>" | jq -r '.concatenated_transcript'
```

## Stop a Call

```bash
curl -s -X POST -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>/stop"
```

## Stop All Active Calls

```bash
curl -s -X POST -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/active/stop"
```

## Play Recording

```bash
${CLAUDE_PLUGIN_ROOT}/bin/bland-play.sh <call_id>

# Or save to file
${CLAUDE_PLUGIN_ROOT}/bin/bland-play.sh <call_id> --save recording.wav
```

## Poll Until Completion

Use when waiting for a call to finish:

```bash
# Using helper script (adaptive intervals: 3s → 10s → 30s)
RESULT=$(${CLAUDE_PLUGIN_ROOT}/bin/bland-poll.sh "$CALL_ID" 300)
echo "$RESULT" | jq '{status, call_length, concatenated_transcript, recording_url}'
```

Or inline:

```bash
while true; do
  RESULT=$(curl -s -H "authorization: $BLAND_API_KEY" \
    "https://api.bland.ai/v1/calls/$CALL_ID")
  COMPLETED=$(echo "$RESULT" | jq -r '.completed')
  STATUS=$(echo "$RESULT" | jq -r '.status')
  if [ "$COMPLETED" = "true" ] || echo "$STATUS" | grep -qE "^(failed|busy|no-answer)$"; then
    echo "$RESULT" | jq '{status, call_length, concatenated_transcript, recording_url}'
    break
  fi
  echo "Status: $STATUS"
  sleep 5
done
```

## Real-Time Monitoring via SSE Stream

### Monitor All Active Calls

Connect to the active calls stream to see real-time status updates for every call:

```bash
# Using helper script (formatted output)
${CLAUDE_PLUGIN_ROOT}/bin/bland-monitor.sh

# Or raw SSE events
${CLAUDE_PLUGIN_ROOT}/bin/bland-monitor.sh --raw
```

Or manually:

```bash
curl -N -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/active/stream"
```

**SSE events**:

On connect — snapshot of all active calls:
```json
{"type":"INITIAL_STATE","data":[
  {"call_id":"abc-123","status":"IN_PROGRESS","from":"+1...","to":"+1...","objective":"Book appt..."}
]}
```

On status change:
```json
{"type":"UPDATE","data":{"call_id":"abc-123","status":"COMPLETE","timestamp":"..."}}
```

Status flow: `QUEUED` → `IN_PROGRESS` → `TRANSFERRED` (optional) → `COMPLETE`

Heartbeat every 30s:
```json
{"type":"HEARTBEAT","timestamp":1710330125000}
```

### Watch Live Transcript of a Specific Call

Stream the conversation as it happens:

```bash
curl -N -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>/transcript/stream"
```

Events:
- `{"type":"initial","messages":[...]}` — existing transcript
- `{"type":"new","text":"Hello","role":"assistant","timestamp":...}` — new speech
- `{"type":"update","transcript_id":"...","text":"corrected text",...}` — STT correction
- `{"type":"end"}` — call finished

Resume from a specific point: `?lastId=<stream_id>`

### Multi-Call Monitoring Pattern

```bash
# 1. Start stream monitor in background
${CLAUDE_PLUGIN_ROOT}/bin/bland-monitor.sh > /tmp/calls.log &

# 2. Create multiple calls (via create-call skill)
# 3. Watch progress
tail -f /tmp/calls.log

# 4. When done, fetch full results for each
curl -s -H "authorization: $BLAND_API_KEY" "https://api.bland.ai/v1/calls/$CALL1" | jq .
curl -s -H "authorization: $BLAND_API_KEY" "https://api.bland.ai/v1/calls/$CALL2" | jq .
```
