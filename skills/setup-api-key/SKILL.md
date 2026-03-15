---
name: bland-setup-api-key
description: >
  Set up and validate a Bland AI API key for voice agent development.
  Use when the user wants to authenticate with Bland AI or needs to configure their API key.
user-invocable: true
---

# Bland AI API Key Setup

## How Bland Auth Works

Authentication is resolved in layers. The Bland AI plugin checks these sources in order:

1. **Environment variable** `BLAND_API_KEY` — checked first
2. **Bland CLI config** at `~/.config/bland-cli-nodejs/config.json` — checked if the env var is not set

If either source provides a valid key, all Bland MCP tools will authenticate automatically.

API keys start with `org_` for organization keys.

## Setup Steps

### 1. Get an API Key

Direct the user to: https://app.bland.ai/dashboard → Settings → API Keys

### 2. Store the Key

Recommend one of these approaches:

**Option A — Environment variable (preferred)**

Add the key to the user's shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`):

```
export BLAND_API_KEY="org_your_key_here"
```

The user should restart their shell or source the profile after adding this.

**Option B — Bland CLI login**

If the user has the Bland CLI installed (`npm i -g @bland-ai/cli`), they can run:

```
bland auth login
```

This stores the key in `~/.config/bland-cli-nodejs/config.json`, which the plugin reads automatically.

### 3. Validate the Key

Use the `bland_call_list` MCP tool with `limit: 1` to confirm authentication works. A successful response returns call data (or an empty array if no calls have been made yet). A 401 error means the key is invalid or missing.

## Error Codes

- `401` — Invalid or missing API key
- `403` — Key lacks permission for this operation
- `429` — Rate limited, back off and retry
