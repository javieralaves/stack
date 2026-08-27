# Stack

Phone-first poker points for Javier and friends at one table. Sample points only — no accounts, no real money.

## Solo (`/`)

Works offline in the browser. Set stack, bet each street, collect, next round. Persists in `localStorage`.

## Table room (`/r/[CODE]`)

Shared round + common pot across phones.

1. On `/`, open **Play with the table** → enter first name → **Start room**.
2. Copy invite / text the short code + URL to buddies.
3. Buddies open `/r/CODE`, sit with a first name + stack.
4. **Call**, **Raise** (or **Bet** to open), or **Fold** — raise opens presets + custom “raise to” total.
5. Winner taps **Collect** on the pot card — takes the full pot and everyone advances to the next round.
6. **Next round** (when pot is empty) clears folds; stacks stay; same room.

Polling every ~1.5s. Max 4 seats (designed for 3).

### Room store env (required for rooms in production)

Serverless Vercel cannot keep an in-memory Map. Rooms use Upstash Redis (Vercel KV-compatible REST).

Set **one** of these pairs on the existing personal-team `stack` project:

| Preferred | Also accepted |
| --- | --- |
| `STACK_KV_REST_URL` | `KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL` |
| `STACK_KV_REST_TOKEN` | `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_TOKEN` |

Create a free Upstash Redis DB → copy REST URL + token into Vercel → redeploy.

Without those env vars, `/` solo mode still works; room APIs return 503.

Local `next dev` uses an in-memory room store when Redis env is unset (`STACK_ROOM_MEMORY=1` forces it).

## Dev

```bash
npm install
npm run dev
```

```bash
npm run build
```

Built with Next.js App Router, TypeScript, and Tailwind.
