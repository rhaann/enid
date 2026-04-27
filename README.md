This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## n8n Webhook Integration

The Brand Input wizard posts submissions to an n8n webhook when you click “Generate Audit Report”.

1. Create a webhook node in n8n and copy its production URL.
2. Create a `.env.local` in the project root and set:

```
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-token
```

3. Restart the dev server.

Payload shape:

```json
{
  "source": "audre-brand-input",
  "submittedAt": "2026-01-05T00:00:00.000Z",
  "data": {
    "websiteUrl": "https://example.com",
    "email": "you@company.com",
    "objectives": ["brand_development"],
    "logoFiles": [{ "name": "logo.svg", "size": 12345, "type": "image/svg+xml" }],
    "social": { "linkedin": "", "twitter": "" },
    "competitors": ["https://competitor.com"],
    "businessGoals": "Grow",
    "companyStage": "Startup (0–2 years)"
  }
}
```

If `NEXT_PUBLIC_N8N_WEBHOOK_URL` is not set, the Submit button simulates a quick delay and succeeds without calling n8n (useful for local development).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
