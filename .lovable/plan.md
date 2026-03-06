
## What to do

Single data operation: INSERT one row into `public.admin_roles` for the existing auth user.

- **user_id**: `f992c201-fc3f-432f-80cf-46c1f457b2d2`
- **email on file**: `admin@t20fannight.com`
- **role**: `super_admin`

No schema changes needed — `admin_roles` table and `get_admin_role()` function already exist from the previous migration. This is a pure data insert using the Supabase insert tool.

After the insert, the `AuthContext.fetchRole()` call will return `super_admin` on next login / session refresh, and the `AdminSidebar` will show all nav items including Roles, Activity, and Leaderboard.

**One-step plan:**
1. Insert `{ user_id: 'f992c201...', role: 'super_admin' }` into `public.admin_roles`

No file changes required — the code already reads this table correctly via `get_admin_role()`.

The user will need to **sign out and sign back in** (or hard-refresh) after the insert so the auth session re-fetches the role.
