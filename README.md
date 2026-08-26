# Stack

Phone-first poker points for Javier and friends at one table. Each phone opens the same URL. No accounts. No shared backend. No real money — sample points only.

## Tonight

1. Open the app on your phone (face-up on the table).
2. **Set stack** — pick a starting points total.
3. Each **round / street**, pick an amount and **Commit**. This-round bets stay visible.
4. When you win, **Collect** (chips or a custom pot amount).
5. **Next round** after collect or fold — clears this-round bets; stack stays.

Stack, round, this-round bet, and last bet persist in `localStorage` on that phone.

## Dev

```bash
npm install
npm run dev
```

```bash
npm run build
```

Built with Next.js App Router, TypeScript, and Tailwind.
