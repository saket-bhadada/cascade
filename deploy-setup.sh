#!/bin/bash
# Quick deployment setup script for Cascade AI

echo "🚀 Cascade AI - Deployment Setup"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Setup Environment Variables${NC}"
read -p "Enter your Hugging Face username: " HF_USERNAME
read -p "Enter your Koyeb service ID (will be generated, leave empty for now): " KOYEB_ID

HF_SPACE_URL="https://${HF_USERNAME}-cascade-ai-engine.hf.space"
KOYEB_BACKEND_URL="https://cascade-backend-${KOYEB_ID}.koyeb.app"

echo ""
echo -e "${GREEN}✓ Configuration:${NC}"
echo "  HF Space: $HF_SPACE_URL"
echo "  Koyeb Backend: $KOYEB_BACKEND_URL"
echo ""

echo -e "${BLUE}Step 2: Create Backend .env${NC}"
cat > server/.env << EOF
PORT=3001
NODE_ENV=production
HF_MODEL_URL=$HF_SPACE_URL
EOF
echo -e "${GREEN}✓ Created server/.env${NC}"

echo ""
echo -e "${BLUE}Step 3: Create Frontend .env${NC}"
cat > client/.env.local << EOF
VITE_API_URL=$KOYEB_BACKEND_URL
EOF
echo -e "${GREEN}✓ Created client/.env.local${NC}"

echo ""
echo -e "${BLUE}Step 4: Next Steps${NC}"
echo "1. Deploy HF Model:"
echo "   - Go to https://huggingface.co/spaces/create"
echo "   - Create new Space with Docker SDK"
echo "   - Clone and push hf_model/ directory"
echo ""
echo "2. Deploy Backend to Koyeb:"
echo "   - Go to https://koyeb.com"
echo "   - Create new service from GitHub"
echo "   - Set environment variables from server/.env"
echo ""
echo "3. Deploy Frontend to Vercel:"
echo "   - Go to https://vercel.com"
echo "   - Import your repository"
echo "   - Set VITE_API_URL from client/.env.local"
echo ""
echo -e "${YELLOW}Important: Update KOYEB_ID after deploying backend!${NC}"
