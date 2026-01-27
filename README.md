# Privacy Scout Web

Web-based privacy scanner for sales team discovery. Scan websites to detect CMPs, Consent Signals, Tag Managers, Third-Party Cookies, and Platforms.

## Deploy to Vercel (Free)

### Option 1: One-Click Deploy

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"

Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to this folder and run:
   ```bash
   vercel
   ```

3. Follow the prompts to deploy

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- **Quick Scan**: Detects CMPs, Consent Signals, Tag Managers, Third-Party Cookies, and Platforms
- **Export CSV**: Download results for reporting
- **Filter & Search**: Easily find specific results
- **Batch Processing**: Scan multiple URLs at once (5 at a time for serverless limits)

## Limitations

- Serverless functions have a 30-second timeout per batch
- URLs are processed 5 at a time to stay within limits
- Some websites may block automated scanning
