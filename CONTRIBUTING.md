# Iterating on VIEW

This is a working playbook for making changes without breaking the live demo.

There are two things to protect:
1. **Code that ships to [view-app-rosy.vercel.app](https://view-app-rosy.vercel.app).** A bad commit on `main` deploys to prod within ~60s.
2. **Seed data on the production Neon DB.** Running `pnpm db:seed` against prod wipes everything; if Maya has clicked through a fresh diligence demo on the live site, that gets erased.

Both are solved by using **branches** — one git branch for code, one Neon branch for data.

---

## Folders + accounts

- **Working clone**: `~/Documents/view-app/` — what you edit. Your `.env.local` here points at the **Neon `dev` branch**, isolated from prod.
- **GitHub**: [goonbo/view-app](https://github.com/goonbo/view-app), `main` is what auto-deploys to prod.
- **Vercel**: project `view-app`, prod URL `view-app-rosy.vercel.app`.
- **Neon project**: `misty-dew-89804836` ("view 2.0"). Two branches:
  - `main` — what prod points at. Treat as read-only-from-your-laptop unless you mean to mutate prod.
  - `dev` — what `.env.local` in this clone points at. Reset / wipe / experiment freely.

---

## Day-to-day: I want to tweak the UI

```bash
cd ~/Documents/view-app
git checkout -b nice-thing       # branch off main
# edit files in src/
pnpm dev                          # http://localhost:3000 — runs against Neon dev branch
```

When it looks good locally:

```bash
git add -A
git commit -m "feat: nice thing"
git push -u origin nice-thing
```

Pushing the branch triggers a **Vercel preview deploy** automatically. Within ~60s, you get a URL like `https://view-app-git-nice-thing-hanleys-projects-59958cdb.vercel.app/`. Open the Vercel dashboard or the PR on GitHub to find it. **Test there before merging.** The preview deploy uses the same prod Neon DB but doesn't change anything until someone clicks "approve" / "save" / etc. — and even those changes only affect prod's data.

When happy:

```bash
gh pr create
gh pr merge --squash   # or merge via the GitHub UI
```

Merge to `main` → Vercel auto-deploys to prod within ~60s.

---

## I want to wipe and reseed the data

`pnpm db:seed` is `DELETE * FROM <every table>; INSERT...`. Always destructive.

### Safe (against dev branch — what your `.env.local` points at)

```bash
cd ~/Documents/view-app
pnpm db:seed
```

### Dangerous (against prod — would wipe whatever Maya / demo viewers did)

```bash
cd ~/Documents/view-app
DATABASE_URL='<prod main-branch URL>' pnpm db:seed
```

You'd only do this when intentionally resetting demo state — e.g. before a sales demo where you want pristine seed data.

---

## I want to reset the dev branch back to "fresh copy of prod"

Useful when you've made a mess of dev data and want a clean slate:

```bash
# Via the Neon dashboard: console.neon.tech → branch "dev" → "Reset from parent"
# Or via the CLI (install once: npm i -g neonctl, then `neonctl auth`):
neonctl branches reset dev --parent
```

That gives you back a copy of whatever's in prod, untouched. No reseed needed.

---

## I want to change the database schema

```bash
# 1. Edit src/db/schema.ts
pnpm db:generate    # creates a new src/db/migrations/0001_*.sql

# 2. Inspect the SQL — make sure it's not destructive
cat src/db/migrations/0001_*.sql

# 3. Apply locally (against dev branch)
pnpm db:migrate

# 4. Commit + PR + merge as normal
```

When the schema change merges to `main` and prod deploys, the migration **does NOT auto-apply to prod**. You apply it manually once, against the prod DB:

```bash
DATABASE_URL='<prod main-branch URL>' pnpm db:migrate
```

> Why manual? Schema changes against shared prod data deserve a moment of human attention. Five seconds of typing > a 4 AM page about a column rename.

---

## I want to try something risky against data

Use a one-off Neon branch:

```bash
# Create a throwaway branch off the current dev branch state
neonctl branches create --name try-thing
neonctl connection-string try-thing > /tmp/try-thing.env

# Point at it
DATABASE_URL="$(cat /tmp/try-thing.env)" pnpm dev

# When done, delete it (Neon's free tier allows many branches but they expire after some inactivity anyway)
neonctl branches delete try-thing
```

---

## I want to switch between fixture mode and live mode

Both modes work locally. Fixture is the default and needs no API keys.

```bash
# Fixture (default)
pnpm dev

# Live — requires ANTHROPIC_API_KEY in .env.local
DATA_MODE=live pnpm dev

# Live + capture: anytime Claude produces something new, save it as a fixture
DATA_MODE=live CAPTURE_FIXTURES=true pnpm dev
```

Captured fixtures land in `src/lib/fixtures/`. **Commit them** so the next demo run works without an API key.

---

## I want to roll back a bad deploy

Two paths in the Vercel dashboard:

- **Instant rollback**: project → Deployments → find the last-known-good production deploy → click ••• → "Promote to Production". No rebuild, takes ~10s.
- **Git revert**: `git revert <bad-commit-sha>` → push → prod redeploys with the bad change undone. Slower but the git history reflects what happened.

Use rollback when you need the site healthy now; use revert when you want the bad commit out of `main`.

---

## Cheat sheet

| Goal | Command |
| --- | --- |
| Edit code locally | `pnpm dev` |
| Type check | `npx tsc --noEmit` |
| Reseed dev DB | `pnpm db:seed` |
| New migration after schema edit | `pnpm db:generate && pnpm db:migrate` |
| Deploy a branch to preview | `git push -u origin <branch>` |
| Ship to prod | merge to `main` |
| Roll back prod | Vercel dashboard → "Promote to Production" on a known-good deploy |
| Reset dev DB to a copy of prod | `neonctl branches reset dev --parent` |

---

## Three things to never do

1. **Don't run `pnpm db:seed` from any clone that doesn't have the dev URL in `.env.local`.** The seed deletes everything. Always verify what your `.env.local` points at before reseeding. (Run `grep DATABASE_URL .env.local | head -c 80` and confirm it's the dev branch hostname.)
2. **Don't `git push --force` to `main`.** Vercel deploys the new HEAD. If the old HEAD had migrations applied to prod and you rewrite history, your prod schema state and your repo's migration history diverge.
3. **Don't commit `.env.local` or any file containing a connection string.** They're in `.gitignore` for a reason. If you ever accidentally commit one, treat the Neon password as compromised and rotate it in the Neon dashboard.
