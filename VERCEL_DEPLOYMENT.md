# Cascade AI - Vercel Frontend Deployment

This guide covers deploying the React frontend to Vercel.

## Quick Start

### 1. Prerequisites

- GitHub account (repository must be public or you have access)
- Vercel account
- Backend URL (from Koyeb deployment)

### 2. Automatic Deployment via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. **Import your GitHub repository**
4. **Select root directory:** `./client`
5. **Configure environment:**
   - Framework Preset: `Vite`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
   - Install Command: `npm install` (auto-detected)

6. **Add Environment Variables:**
   - Name: `VITE_API_URL`
   - Value: `https://cascade-backend-YOUR_ID.koyeb.app`
   - Click **"Add"**

7. Click **"Deploy"**

Vercel will:

- Build the frontend
- Deploy it to a CDN
- Provide you a URL like `https://cascade-frontend.vercel.app`

### 3. Manual Deployment via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to client directory
cd client

# Deploy with environment variables
vercel --env VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app

# Or link to existing Vercel project
vercel link
vercel env add VITE_API_URL
# Paste: https://cascade-backend-YOUR_ID.koyeb.app
vercel
```

## Configuration

### vercel.json

The `vercel.json` file in the client directory controls build and runtime behavior:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "env": {
    "VITE_API_URL": {
      "description": "Backend API endpoint"
    }
  }
}
```

### Environment Variables

**Required for production:**

```
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

**Optional for development:**

- If not set, defaults to `http://localhost:3001`

## Updating After Deployment

### 1. Via Git Push (Recommended)

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Vercel automatically redeploys on push.

### 2. Via Vercel Dashboard

- Go to your Vercel project
- View deployments
- Click "Redeploy" on any previous deployment
- Or make git changes and push

### 3. Via Vercel CLI

```bash
cd client
vercel --prod
```

## Custom Domain

### 1. In Vercel Dashboard

- Go to Project Settings → Domains
- Click "Add Domain"
- Enter your custom domain
- Add DNS records as shown

### 2. Example

- Domain: `cascade-ai.example.com`
- Points to: Vercel's nameservers

## Monitoring

### View Deployment Status

```bash
vercel deploy --list
```

### Check Logs

```bash
# Real-time logs
vercel logs

# Check build logs
cd client && npm run build
```

### Monitor Performance

- Vercel Dashboard → Analytics
- Check Web Vitals
- Monitor HTTP requests

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**

```bash
cd client
npm install
npm run build
```

**Error: "ENOENT: no such file or directory"**

- Verify `vercel.json` has correct `outputDirectory`
- Ensure `package.json` build script is correct

### Environment Variables Not Working

**Frontend shows "Cannot reach backend"**

1. Check Vercel dashboard environment variables
2. Verify `VITE_API_URL` is set correctly
3. Restart deployment: `vercel --prod`
4. Clear browser cache (Ctrl+Shift+Delete)

**VITE\_ prefix required:**

- In Vercel, env vars must start with `VITE_` to be exposed to frontend
- Backend env vars don't need this prefix

### API Endpoint Issues

**Frontend throws CORS error**

1. Check backend is deployed to correct URL
2. Verify backend has CORS enabled
3. Check `VITE_API_URL` matches backend URL exactly

**API returns 404**

1. Verify backend service is running on Koyeb
2. Check backend `/api/health` endpoint
3. Review backend logs on Koyeb dashboard

## Advanced Features

### Preview Deployments

- Every git push creates a preview URL
- Share `https://cascade-abc123.vercel.app` for feedback
- Merge to main for production

### Rollback

```bash
# List deployments
vercel deployments

# Promote old deployment to production
vercel promote <deployment-id>
```

### Git Integration

- Automatic deploys on:
  - Push to main branch
  - Pull request created (preview)
  - Rebase/merge to main

## Performance Optimization

The Vite build includes:

- Code splitting
- Tree shaking
- Minification
- Asset optimization

Check Vercel Analytics for:

- Core Web Vitals
- Performance metrics
- User experience scores

## Cost

- **Hobby plan**: Free
  - 100 GB bandwidth/month
  - 65,000 function invocations/month
  - Great for testing

- **Pro plan**: $20/month
  - 1 TB bandwidth/month
  - 1,000,000 function invocations/month

## Support

- [Vercel Docs](https://vercel.com/docs)
- [Vite Docs](https://vitejs.dev)
- [GitHub Issues](https://github.com/vercel/vercel/issues)
