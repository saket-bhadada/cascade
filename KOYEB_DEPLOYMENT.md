# Cascade AI - Koyeb Backend Deployment

This guide covers deploying the Node.js backend to Koyeb.

## Quick Start

### 1. Prerequisites

- GitHub account (repository public or accessible)
- Koyeb account
- HF Model URL from Hugging Face Space deployment

### 2. Deployment Steps

#### Step 1: Prepare Your Repository

Ensure your GitHub repo has:

- `server/server.js` - Main application
- `server/package.json` - Dependencies
- `.github/` or root-level configuration (optional)

#### Step 2: Deploy to Koyeb

**Option A: Via Koyeb Dashboard (Recommended)**

1. Go to [koyeb.com](https://koyeb.com)
2. Sign in and click **"Create Service"**
3. **Select Source:**
   - Choose "GitHub"
   - Select your repository
   - Branch: `main`

4. **Configure Build:**
   - Buildpack: `Node`
   - Build directory: `server`
   - Run command: `npm start`

5. **Configure Environment:**
   Click **"Environment"** and add:

   ```
   PORT=3001
   NODE_ENV=production
   HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space
   ```

6. **Review and Deploy:**
   - Service name: `cascade-backend`
   - Instance type: `Free` or `Standard`
   - Click **"Create Service"**

Wait 2-5 minutes for deployment.

**Option B: Via Koyeb CLI**

```bash
# Install Koyeb CLI
npm install -g @koyeb/cli

# Login
koyeb auth login

# Deploy
koyeb services create cascade-backend \
  --git YOUR_USERNAME/cascade \
  --git-branch main \
  --git-builder buildpack \
  --buildpack node \
  --git-working-dir server \
  --ports 3001:http \
  --env PORT=3001 \
  --env NODE_ENV=production \
  --env HF_MODEL_URL=https://YOUR_USERNAME-cascade-ai-engine.hf.space \
  --min-scale 1 \
  --max-scale 3
```

**Option C: Using koyeb.yaml**

Create `koyeb.yaml` in repository root:

```yaml
services:
  - name: cascade-backend
    git:
      repository: https://github.com/YOUR_USERNAME/cascade
      branch: main
      buildpack: node
    build:
      working_dir: server
    run:
      command: npm start
    ports:
      - protocol: http
        port: 3001
    env:
      - key: PORT
        value: "3001"
      - key: NODE_ENV
        value: production
      - key: HF_MODEL_URL
        scope: SERVICE
        value: https://YOUR_USERNAME-cascade-ai-engine.hf.space
```

Then deploy:

```bash
# Via Koyeb dashboard, just push to main
git add koyeb.yaml
git commit -m "Add Koyeb config"
git push
```

## Configuration

### Environment Variables

Set these in Koyeb dashboard or `koyeb.yaml`:

| Variable       | Value                                         | Description      |
| -------------- | --------------------------------------------- | ---------------- |
| `PORT`         | `3001`                                        | Server port      |
| `NODE_ENV`     | `production`                                  | Environment mode |
| `HF_MODEL_URL` | `https://USERNAME-cascade-ai-engine.hf.space` | Model API URL    |

### package.json Scripts

The backend should have these scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2"
  }
}
```

### ports Configuration

The service listens on port 3001 by default:

- HTTP Protocol
- Port: 3001
- Exposed publicly as: `https://cascade-backend-SERVICE_ID.koyeb.app`

## Your Deployment URL

Once deployed, your backend will be available at:

```
https://cascade-backend-YOUR_SERVICE_ID.koyeb.app
```

Example:

```
https://cascade-backend-abc123def456.koyeb.app
```

**Use this URL as `VITE_API_URL` in your Vercel frontend deployment.**

## Monitoring

### View Service Status

```bash
koyeb services list
koyeb services info cascade-backend
```

### View Logs

```bash
# Real-time logs
koyeb services logs cascade-backend

# Last 50 lines
koyeb services logs cascade-backend --tail 50
```

### Via Dashboard

- Go to Service → Logs
- View deployment history
- Check health status

## Scaling

### Auto-scaling Configuration

Koyeb can auto-scale based on CPU/memory:

```yaml
# In koyeb.yaml
services:
  - name: cascade-backend
    min_scale: 1
    max_scale: 3
```

Or via CLI:

```bash
koyeb services update cascade-backend --min-scale 1 --max-scale 3
```

### Manual Scaling

```bash
# Via dashboard: Settings → Scaling
# Adjust min/max instances
```

## Updating Deployment

### Automatic (Recommended)

1. Make changes to `server/` directory
2. Commit and push to main:
   ```bash
   git add server/
   git commit -m "Update backend API"
   git push origin main
   ```
3. Koyeb automatically redeploys

### Manual Redeploy

```bash
koyeb services redeploy cascade-backend
```

## Health Checks

Your backend should have a health check endpoint:

```javascript
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
```

Koyeb will periodically check this to ensure the service is running.

Test it:

```bash
curl https://cascade-backend-YOUR_ID.koyeb.app/api/health
```

## Troubleshooting

### Service Won't Start

**Check logs:**

```bash
koyeb services logs cascade-backend
```

**Common issues:**

- Missing environment variables
- `npm start` script not defined
- Port already in use
- Dependency installation failed

**Fix:**

```bash
# Ensure package.json has start script
# Manually test locally:
cd server
npm install
npm start
```

### HF Model Connection Failed

**Error:** `Failed to fetch from Hugging Face model API`

**Check:**

1. HF_MODEL_URL is correct
2. HF Space is deployed and public
3. Network connectivity (test with curl)

```bash
# Test from Koyeb container
curl https://YOUR_USERNAME-cascade-ai-engine.hf.space/
```

### CORS Errors

**Frontend getting CORS error:**

- Backend has CORS enabled: ✓ (`app.use(cors())`)
- Check frontend VITE_API_URL matches service URL

### Port Issues

**Port 3001 already in use:**

- This shouldn't happen in Koyeb containers
- If stuck, delete and redeploy service

## Performance Tips

1. **Enable caching:**

   ```javascript
   app.use(express.static(..., {
     maxAge: '1h'
   }));
   ```

2. **Optimize proxy requests:**

   ```javascript
   const response = await fetch(url, { timeout: 30000 });
   ```

3. **Monitor logs:**
   ```bash
   koyeb services logs cascade-backend --follow
   ```

## Cost

- **Free Tier**: $0/month
  - 1 free instance
  - Limited to 2 concurrent services
  - 20GB network bandwidth/month

- **Standard**: Starting at $12/month
  - Unlimited instances
  - More bandwidth
  - Priority support

## Useful Commands

```bash
# Create service
koyeb services create cascade-backend ...

# List services
koyeb services list

# Get service info
koyeb services info cascade-backend

# View logs
koyeb services logs cascade-backend

# Redeploy
koyeb services redeploy cascade-backend

# Delete service
koyeb services delete cascade-backend

# Update config
koyeb services update cascade-backend --env PORT=3001
```

## Integration with Vercel Frontend

After deployment, use the service URL in Vercel:

```
VITE_API_URL=https://cascade-backend-YOUR_ID.koyeb.app
```

The frontend will proxy all API calls through this URL to your HF model.

## Support

- [Koyeb Docs](https://docs.koyeb.com)
- [Koyeb CLI Reference](https://docs.koyeb.com/reference/koyeb-cli)
- [Community](https://community.koyeb.com)
