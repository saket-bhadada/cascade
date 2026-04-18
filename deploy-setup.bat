@echo off
REM Quick deployment setup script for Cascade AI (Windows)

echo 🚀 Cascade AI - Deployment Setup
echo =================================
echo.

setlocal enabledelayedexpansion

echo Step 1: Setup Environment Variables
set /p HF_USERNAME="Enter your Hugging Face username: "
set /p KOYEB_ID="Enter your Koyeb service ID (will be generated, leave empty for now): "

if not defined KOYEB_ID (
    set KOYEB_BACKEND_URL=https://cascade-backend-YOUR_ID.koyeb.app
) else (
    set KOYEB_BACKEND_URL=https://cascade-backend-!KOYEB_ID!.koyeb.app
)

set HF_SPACE_URL=https://!HF_USERNAME!-cascade-ai-engine.hf.space

echo.
echo ✓ Configuration:
echo   HF Space: !HF_SPACE_URL!
echo   Koyeb Backend: !KOYEB_BACKEND_URL!
echo.

echo Step 2: Create Backend .env
(
    echo PORT=3001
    echo NODE_ENV=production
    echo HF_MODEL_URL=!HF_SPACE_URL!
) > server\.env
echo ✓ Created server\.env
echo.

echo Step 3: Create Frontend .env.local
(
    echo VITE_API_URL=!KOYEB_BACKEND_URL!
) > client\.env.local
echo ✓ Created client\.env.local
echo.

echo Step 4: Next Steps
echo 1. Deploy HF Model:
echo    - Go to https://huggingface.co/spaces/create
echo    - Create new Space with Docker SDK
echo    - Clone and push hf_model/ directory
echo.
echo 2. Deploy Backend to Koyeb:
echo    - Go to https://koyeb.com
echo    - Create new service from GitHub
echo    - Set environment variables from server\.env
echo.
echo 3. Deploy Frontend to Vercel:
echo    - Go to https://vercel.com
echo    - Import your repository
echo    - Set VITE_API_URL from client\.env.local
echo.
echo Important: Update KOYEB_ID after deploying backend!

endlocal
