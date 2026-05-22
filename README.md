# ShadowChat

  A luxury dark-themed anonymous chat platform built with React + Firebase.

  ## Stack
  - React + Vite + TypeScript
  - Firebase (Anonymous Auth + Firestore)
  - Tailwind CSS + Framer Motion
  - pnpm workspaces

  ## Routes
  - `/` — Landing page
  - `/chat` — Private persona chat rooms
  - `/admin` — Admin dashboard (PIN: shadow2024)

  ## Vercel Deployment
  1. Import this repo in Vercel
  2. Build command: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/shadowchat run build`
  3. Output directory: `artifacts/shadowchat/dist/public`
  4. Set Firebase env vars in Vercel dashboard
  