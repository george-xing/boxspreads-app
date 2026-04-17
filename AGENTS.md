<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Environment variables — read this BEFORE running `pnpm dev`

Real secrets live at **`~/.boxspreads/.env.local`** (outside any git directory, perms 700/600). Each worktree's `.env.local` is a symlink to that file.

When you create a new worktree, the symlink isn't there. Run:

```bash
./scripts/link-env.sh
```

This is idempotent and safe to re-run. Without it `pnpm dev` will look connected but every API call that needs a key (FRED, Schwab, Supabase) will fall back / fail.

If `~/.boxspreads/.env.local` doesn't exist yet, bootstrap it:

```bash
mkdir -p ~/.boxspreads && chmod 700 ~/.boxspreads
cp .env.local.example ~/.boxspreads/.env.local
chmod 600 ~/.boxspreads/.env.local
# then fill in real values
```

Never commit `.env.local`. Never put real secrets inside the repo tree — worktree removal, `git clean -fdx`, and fresh clones will lose them.
