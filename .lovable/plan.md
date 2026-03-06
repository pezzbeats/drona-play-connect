
## Root Cause — Confirmed

ElevenLabs sends tool parameters **flat at the root** of the request body, NOT nested under a `parameters` key:

```text
// What ElevenLabs actually sends:
{"tool_name": "check_registration", "mobile": "8449710150"}

// What the code looks for:
body.parameters.mobile  → undefined (body.parameters is undefined → falls back to {})
```

The logs prove this:
- My test curl: `{"tool_name":"check_registration","parameters":{"mobile":"8449710150"}}` → works ✅
- Real ElevenLabs call: `{"tool_name":"check_registration","mobile":"8449710150"}` → mobile is `undefined` → returns "no registration found" ❌

## Fix

Update parameter extraction in `elevenlabs-tools/index.ts` to check **all three locations** for each parameter:

1. `body.parameters.mobile` (nested under `parameters`)
2. `body.params.mobile` (nested under `params`)
3. `body.mobile` (flat at root — what ElevenLabs actually sends)

Change this single line:
```ts
// Before:
const parameters = body.parameters || body.params || {};
const params = parameters;

// After:
const params = body.parameters || body.params || body || {};
```

By falling back to `body` itself, every field in the root payload becomes accessible — so `params.mobile` will correctly find `body.mobile` when ElevenLabs sends it flat.

Also add `tool_name` to the exclusion-safe extraction by ensuring the `toolName` extraction stays as-is (it reads from `body.tool_name` directly, which is correct).

## File to Change

- `supabase/functions/elevenlabs-tools/index.ts` — lines 22–26: fix params extraction, then redeploy.

This single one-line fix resolves all four tools simultaneously since they all use `params.mobile` or `params.*` for their parameter access.
