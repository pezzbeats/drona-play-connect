
## Root Cause Analysis

### Issue 1: "non-2xx" Payment Error on Pay at Hotel

The user says they got a "non-xxx something" error. From Supabase JS SDK, this is specifically **`FunctionsHttpError`** — when an edge function returns a non-200 status code, `supabase.functions.invoke()` puts the error in the `error` object AND the response body is NOT automatically parsed.

Looking at the code in `handleCreateOrder` (Register.tsx line 433-458):
```ts
const { data, error } = await supabase.functions.invoke('create-order', { body: {...} });
if (error) throw error;
```

When Supabase JS catches a non-2xx HTTP response from an edge function, the `error` object is a `FunctionsHttpError` whose `.message` is just `"non-2xx status code"` — not the actual error message from the function body. The real error details are in `error.context` (the raw Response object).

**But why was the function returning non-200?** Looking at the `create-order` edge function — it returns HTTP 400 on any exception with `{ error: e.message }`. When the Supabase JS client receives a 400, it wraps it in `FunctionsHttpError` with a generic message.

The **actual root cause**: The `create-order` function has this line:
```ts
const { data: match } = await supabase.from("matches").select("*, events(id)").eq("id", match_id).single();
if (!match) throw new Error("Match not found");
```

The match query uses `.single()` which throws if no result — but the match status for the active match is `"draft"` (confirmed from DB query). Looking at `create-order`, there's no status filter — it just selects by `id`. So this should work.

However, the **real problem** is that `supabase.functions.invoke` with a 400 status code from the function **does NOT surface the function's error message** — it only says "non-2xx status code". The `error.message` from `FunctionsHttpError` is always generic.

The fix needs to:
1. **In the edge function**: Always return HTTP 200 with `{ error: ... }` in the body — never return 4xx/5xx for business logic errors (only truly unhandled crashes should be non-200). This ensures the Supabase JS client can read the error message.
2. **In the client code**: After `supabase.functions.invoke`, check for `data.error` in addition to `error` and display the real message.

### Issue 2: "Confused text hindering button taps"

Looking at Register.tsx lines 710-714:
```tsx
<div className="flex items-center justify-between mb-1.5">
  <Label className="text-foreground w-full text-center">Mobile Number *</Label>
  <span className={`text-xs font-mono ...`}>{mobile.length}/10</span>
</div>
```
The label has `w-full text-center` but is inside a flex row with the counter span — this means the label takes full width AND a counter is next to it, causing visual overlap. The label's `text-center` alignment pushes content, and on narrow screens the counter could overlap taps on the input field below.

Also, the disclaimer bar at top and preview mode banner are sticky/fixed position elements that can cover content.

More critically: The step bar uses very narrow `width: 25%` columns with text that may wrap/overlap on small screens (step label text like "Your Tickets" is long).

## Fix Plan

### 1. Fix edge function error surfacing (Root cause of "non-2xx" error)

**`supabase/functions/create-order/index.ts`**: Change all error responses to return HTTP **200** with `{ success: false, error: "..." }` so the Supabase JS client can read the actual error message from `data.error`.

**`src/pages/Register.tsx`** `handleCreateOrder`: Check `data?.error` after invoke and throw a proper error with the real message.

### 2. Fix UI text overlap issues

**`src/pages/Register.tsx`**:
- Fix the Mobile Number label row — remove `w-full text-center` conflict, put the counter inline properly
- Fix StepBar labels to use `text-[10px]` or truncate on very small screens to prevent layout shift
- Ensure the disclaimer bar doesn't overlap the form

## Files to Change

1. `supabase/functions/create-order/index.ts` — return HTTP 200 for all errors, change response shape to `{ success: false, error: "..." }` for errors and `{ success: true, order_id, tickets }` for success
2. `src/pages/Register.tsx` — update `handleCreateOrder` to check `data?.error`, fix the mobile label flex row overlap, fix StepBar responsive text
