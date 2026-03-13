---
name: bland-live-listen
description: >
  Listen to in-progress Bland AI calls in real-time through your speakers.
  Use when the user wants to hear a live call, monitor audio quality, or
  listen to an ongoing conversation.
user-invocable: true
---

# Bland AI Live Listen

## Prerequisites

- Call must be **in-progress** (not completed)
- Organization must have `live_listen_enabled`
- Dependencies: `websocat` (WebSocket CLI), `sox` (audio playback via `play`)

Install on macOS:
```bash
brew install websocat sox
```

## Listen to a Live Call

```bash
${CLAUDE_PLUGIN_ROOT}/bin/bland-listen.sh <call_id>
```

Press `Ctrl+C` to stop listening.

## How It Works

1. `POST /v1/calls/:call_id/listen` returns a WebSocket URL streaming raw audio
2. `websocat` connects to the WebSocket and receives binary audio frames
3. `sox` (`play`) decodes **s16le 16kHz mono** audio and plays through speakers

**Important**: Use websocat's `cmd:` specifier to pipe audio to the player — standard
shell pipes (`websocat | play`) do NOT work reliably due to websocat output buffering.

## Manual Steps (if not using the script)

```bash
# 1. Get the WebSocket streaming URL
WSS_URL=$(curl -s -X POST \
  -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>/listen" | jq -r '.data.url // .url')

# 2. Connect and play audio via websocat cmd: specifier
websocat --binary --no-close \
  "$WSS_URL" \
  "cmd:play -t raw -r 16000 -e signed-integer -b 16 -c 1 -q -" \
  2>/dev/null
```

## Combine with Live Transcript

For the richest monitoring experience, run live listen AND transcript stream simultaneously:

```bash
# Terminal 1: Audio
${CLAUDE_PLUGIN_ROOT}/bin/bland-listen.sh <call_id>

# Terminal 2: Live transcript
curl -N -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls/<call_id>/transcript/stream"
```

## Audio Format

The WebSocket streams raw PCM audio:
- **Encoding**: s16le (signed 16-bit little-endian)
- **Sample rate**: 16,000 Hz
- **Channels**: 1 (mono)
- **Byte rate**: ~32,000 bytes/sec

This is NOT mulaw/G.711 despite being telephony. The Bland API transcodes to linear PCM.

## Troubleshooting

- **"Could not get live listen URL"**: Call may have ended, or `live_listen_enabled` is off for your org
- **No audio / immediate exit**: The call likely ended before the WebSocket connected. Ensure the call status is `in-progress` before calling the listen endpoint
- **Loud static**: Wrong audio format. Must use `s16le` at `16000` Hz (not mulaw, not 8kHz)
- **Audio plays too slow**: Sample rate is too low — use 16kHz, not 8kHz
- **Audio plays too fast / chipmunk**: Sample rate is too high — use 16kHz, not 24kHz or 48kHz
- **Silence with shell pipe (`websocat | play`)**: Known issue — websocat buffers output when piped. Use the `cmd:` specifier instead (see Manual Steps above)
- **`websocat: Invalid argument (os error 22)`**: Can occur intermittently with long JWT-based WSS URLs. Retry; if persistent, check `websocat --version` (tested with 1.14.1)
- **Choppy / stuttering audio**: Network latency or system audio buffer underrun. Close other audio-heavy apps

### Debugging: Capture raw audio to file

To verify the audio stream is working without playback issues:
```bash
# Capture 10 seconds of raw audio
websocat --binary --no-close "$WSS_URL" > /tmp/bland_debug.raw &
PID=$!; sleep 10; kill $PID 2>/dev/null

# Check byte count (~32KB per second expected)
wc -c < /tmp/bland_debug.raw

# Inspect format (should show small 16-bit integer values)
xxd -l 64 /tmp/bland_debug.raw

# Play the captured file
play -t raw -r 16000 -e signed-integer -b 16 -c 1 /tmp/bland_debug.raw
```
