---
name: bland-setup-api-key
description: >
  Set up and validate a Bland AI API key for voice agent development.
  Use when the user wants to authenticate with Bland AI or needs to configure their API key.
user-invocable: true
---

# Bland AI API Key Setup

## How Bland Auth Works
Bland AI uses API keys passed via the `authorization` header. **Important**: This is NOT a Bearer token — pass the raw key directly.

```
authorization: org_your_api_key_here
```

API keys start with `org_` for organization keys.

## Setup Steps

### 1. Check if Already Configured

Before asking the user for a key, check if `BLAND_API_KEY` is already set:

```bash
if [ -z "$BLAND_API_KEY" ]; then echo "NOT_SET"; else echo "SET"; fi
```

If it's set, skip to step 3 (Validate) to confirm it works. Only ask the user for a key if it's missing or invalid.

### 2. Get an API Key
Direct the user to: https://app.bland.ai/dashboard → Settings → API Keys

### 3. Store the Key

Save the key to a persistent env file so it survives across shell sessions and commands:

```bash
echo 'export BLAND_API_KEY="org_your_key_here"' > /tmp/bland_env.sh
source /tmp/bland_env.sh
```

**Critical**: Once stored, always use `$BLAND_API_KEY` in all curl commands. Never copy-paste or retype the raw key string into commands — API keys are long and error-prone to transcribe. Always `source /tmp/bland_env.sh` at the start of each Bash command to ensure the variable is available, since environment variables do not persist between separate Bash tool invocations.

For the user's persistent storage, recommend adding to shell profile (`~/.zshrc`, `~/.bashrc`) or a `.env` file (ensure `.env` is in `.gitignore`).

### 4. Validate the Key
```bash
source /tmp/bland_env.sh
curl -s -H "authorization: $BLAND_API_KEY" \
  "https://api.bland.ai/v1/calls?limit=1" | jq '.status // .errors'
```

A successful response returns call data (or an empty array if no calls yet). A 401 means the key is invalid.

## Error Codes
- `401` — Invalid or missing API key
- `403` — Key lacks permission for this operation
- `429` — Rate limited, back off and retry
