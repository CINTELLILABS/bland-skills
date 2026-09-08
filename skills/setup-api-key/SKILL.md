---
name: bland-setup-api-key
description: >
  Set up and validate a Bland AI API key for voice agent development.
  Use when the user wants to authenticate with Bland AI or needs to configure their API key.
user-invocable: true
---

# Setting Up Your Bland AI API Key

## Device Flow (Preferred)

Works whether you're running locally, over SSH, or as a hosted bot with no browser of your own. A human completes signup in their own browser while you poll for the result.

1. Call `bland_auth_login` with `mode: "device"`, or leave `mode` unset. Unset uses device mode: the MCP server always runs over piped stdio, so `auto` resolves to device.
2. If the tool returns `already_authenticated`, the user is good to go: skip to Validation.
3. Otherwise it returns `status: "awaiting_approval"` with `user_code`, `verification_url_complete`, `device_code`, `expires_in` (seconds), and `interval` (seconds). Tell the human, verbatim:
   - "Open `<verification_url_complete>` and enter the code `<user_code>`."
   - Mention that signing up (or logging in) requires subscribing to the Agent Phone Plan ($29.99/mo).
4. Poll `bland_auth_poll` with the `device_code`, waiting `interval` seconds between calls. Keep polling until `expires_in` elapses (up to 15 minutes).
   - `status: "pending"`: keep polling at the given `interval`.
   - `status: "slow_down"`: you polled too fast, wait the new `interval` before the next call.
   - `status: "approved"`: the API key is saved to local config automatically. Confirm the provisioned phone number (`phone_number`) and plan (`plan_summary`) to the user.
   - `status: "expired"`: the code timed out before the human finished. Call `bland_auth_login` again for a fresh code and restart from step 3.

## Browser Loopback (Opt-in)

Browser mode is opt-in. If the agent has a local browser, call `bland_auth_login` with `mode: "browser"`. This opens a browser to sign up or log in, waits for completion, and saves the API key automatically.

If it returns `already_authenticated`, skip to Validation. If it returns `status: "authenticated"`, confirm setup is complete and mention the provisioned phone number if one was returned.

## Manual Fallback

If both flows fail (timeout, no browser, network issues), fall back to manual setup:

1. Tell the user to visit **https://app.bland.ai** and create an account
2. After signup, navigate to **Settings > API Keys** and copy the key (starts with `org_`)
3. Ask the user to paste their API key
4. Save it by telling the user to set the environment variable:
   ```bash
   export BLAND_API_KEY="org_your_key_here"
   ```
   Or store it in their shell profile (`~/.bashrc`, `~/.zshrc`) for persistence.

## Validation

After setup (any method), validate the key works by calling `bland_call_list` with `limit: 1`.

- **Success**: Returns a list (even if empty) — the key is valid
- **401 error**: Key is invalid — ask the user to try again
- **403 error**: Key lacks permissions — user may need to check their org settings

## Billing Issues

If the user encounters billing-related errors when making calls, direct them to **https://app.bland.ai** to check their plan and payment details. Device-flow setup requires an active Agent Phone Plan subscription; other usage may need a different plan or additional payment setup under Settings > Billing.
