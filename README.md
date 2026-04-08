# TempoTread — Interval Timer

I built this because I couldn't find an interval timer that worked the way I needed. Every app I tried either:

- Charged money just to remove interruptions
- Wouldn't let me use my own music
- Had some other "premium" feature I didn't want

So I made this. It lets you upload your own MP3s, create interval workouts, and play your music without anything getting in the way. No subscriptions, no ads, no upsells.

**Note:** This is still a work in progress. I use it regularly and keep refining it as I go.

## What It Does

- Upload your own MP3 files for audio cues
- Build custom interval workouts
- Visual timeline so you can see what's coming
- Play your music without interruptions

## Tech Stack

- React 19 + TypeScript
- Vite
- TailwindCSS v4
- Firebase (auth and data)
- Framer Motion (for animations)

## Getting Started

You need Node.js (v18+).

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

### Build for production

```bash
npm run build
```

Output goes to `dist/`.

## License

MIT
