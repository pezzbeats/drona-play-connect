
## Bulk Import Players — Plan

### What to build

A "Bulk Import" dialog button next to "Add Player" in the Players tab. Admin pastes a multi-line list, each line is parsed into a player row, previewed, then inserted in one batch.

### Paste format (flexible, auto-detected)

Each line = one player. Supported formats:
```
Rohit Sharma, batsman, 45
Jasprit Bumrah, bowler, 93
Hardik Pandya, all_rounder, 33
MS Dhoni, wicketkeeper, 7
Virat Kohli
```

Parse rules:
- Field 1 (required): name
- Field 2 (optional): role keyword match — if it contains "bowl" → bowler, "all" → all_rounder, "keep" or "wk" or "wicket" → wicketkeeper, else → batsman (default)
- Field 3 (optional): jersey number
- Separator: comma OR tab OR pipe (`|`)
- Blank lines skipped
- Case-insensitive role matching

### Format hint shown in the dialog textarea placeholder:
```
Rohit Sharma, batsman, 45
Jasprit Bumrah, bowler, 93
Hardik Pandya, all_rounder, 33
MS Dhoni, wicketkeeper, 7
```

### UI flow

1. "Bulk Import" button (with `Upload` icon) opens a Dialog
2. Dialog has:
   - Team selector at top (required — all imported players assigned to this team)
   - Textarea for paste input
   - "Preview" button → parses and shows a small table of parsed rows with name, role badge, jersey — with inline error indicator for rows that couldn't parse
   - "Import X players" button (disabled until preview shows at least 1 valid row)
   - Progress state during insert
   - Success summary: "X players imported"
3. On import: `supabase.from('players').insert(rows)` for all valid rows at once
4. Close dialog → refresh player list

### Only change needed

`src/pages/admin/AdminTeams.tsx` — add `BulkImportDialog` component inside `PlayersTab`:
- New state: `bulkOpen`, `bulkText`, `bulkTeamId`, `parsedRows`, `previewed`, `importing`
- Parse function: split by newline, split each line by `,` or `\t` or `|`, map to player shape
- New imports: `Textarea` from `@/components/ui/textarea`, `Upload` from `lucide-react`
- No DB schema changes needed

### Files changed
- `src/pages/admin/AdminTeams.tsx` only
