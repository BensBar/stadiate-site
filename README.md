# stadiate-site

Marketing site for **Stadiate** — _any room can be your stadium._

Static site (no build step): `index.html` + `privacy.html` + `assets/`.
The `/privacy` page satisfies the App Store privacy-policy requirement.

## Deploy (Cloudflare Pages)

DNS for `stadiate.com` is already on Cloudflare, so:

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
3. Build settings: **Framework preset: None**, **Build command: (empty)**, **Output directory: `/`**.
4. After the first deploy → **Custom domains** → add `stadiate.com` and `www.stadiate.com`.

Automatic HTTPS is included; every push to `main` redeploys.

## Product screenshots

`assets/shots/` images are captured from the live Stadiate hub with Playwright:

```bash
npm install
BASE=http://localhost:8787 node tools/shoot.mjs
```

(Requires a running Stadiate hub reachable at `BASE`.)
