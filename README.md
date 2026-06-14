# SplitCheck

Split bills with friends, scan receipts, and generate personality-filled group chat messages — built for InstaPay.

## Features

- **No login** — open the app and start splitting
- **Receipt scanning** — photo a receipt to auto-fill items, tax, and tip (Google Gemini, free tier)
- **5-step wizard** — people → items → assign → tax/tip → summary
- **InstaPay** — add phone number or handler for the payer; included in the copy-paste message
- **Personality tones** — Chill, Roast, Corporate, Wholesome
- **Saved groups** — reuse your regular dining crew
- **Split history** — stored in your browser (localStorage)

## Stack

- [Next.js 15](https://nextjs.org/) (App Router, Tailwind CSS)
- [`packages/core`](packages/core) — proportional tax/tip split calculator
- [Google Gemini](https://ai.google.dev/) — receipt vision extraction via `/api/receipts/parse`

No backend server, database, or Docker.

## Getting started

**Prerequisites:** Node.js 20+, pnpm 10+

```bash
git clone https://github.com/YOUR_USERNAME/receipt-splitter.git
cd receipt-splitter
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Add a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) to `apps/web/.env.local`:

```env
GEMINI_API_KEY=your-key-here
GEMINI_VISION_MODEL=gemini-2.5-flash-lite
```

Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project structure

```
apps/web/           Next.js app (UI + receipt scan API route)
packages/core/      Shared split math, Zod schemas, unit tests
packages/tsconfig/  Shared TypeScript configs
```

## Scripts

| Command       | Description              |
|---------------|--------------------------|
| `pnpm dev`    | Start Next.js on :3000   |
| `pnpm build`  | Production build         |
| `pnpm test`   | Run split calculator tests |

## Deploy

Deploy `apps/web` to [Vercel](https://vercel.com). Set `GEMINI_API_KEY` in the project environment variables.

> **Note:** Groups and split history live in the browser only — they won't sync across devices.

## Example message

```
The receipt has entered the chat:

Alice covered the bill — send them:
• Bob → $28.61 (wallet said ouch with that burrito)
• Carol → $5.72 (the group subsidized this with that guac)

InstaPay: 01012345678
Pay up before the vibes curdle.
```

## License

MIT
