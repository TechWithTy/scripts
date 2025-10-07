#!/bin/bash

# ========================================
# 🚀 DealScale Deployment Setup Script
# ========================================
# This script helps set up deployment configurations
# for different hosting platforms

set -e

echo "🚀 DealScale Deployment Setup"
echo "=============================="

# Detect platform
PLATFORM=""
if command -v wrangler &> /dev/null; then
    PLATFORM="cloudflare"
elif command -v vercel &> /dev/null; then
    PLATFORM="vercel"
elif command -v docker &> /dev/null; then
    PLATFORM="docker"
else
    echo "❌ No supported deployment platform detected"
    echo "💡 Install: wrangler (Cloudflare), vercel (Vercel), or docker (Self-hosted)"
    exit 1
fi

echo "✅ Detected platform: $PLATFORM"

# Create deployment configs
case $PLATFORM in
    "cloudflare")
        echo "🌐 Setting up Cloudflare Pages deployment..."

        # Check if wrangler.toml exists
        if [ ! -f "wrangler.toml" ]; then
            echo "📝 Creating wrangler.toml..."
            cat > wrangler.toml << 'EOF'
name = "dealscale"
compatibility_date = "2024-01-01"

[build]
command = "pnpm build"
cwd = "."
watch_dir = "src"

[build.upload]
format = "modules"
exclude = ["content/**", "strapi-export/**", "**/_docs/**"]

[vars]
NODE_ENV = "production"
EOF
            echo "✅ Created wrangler.toml"
        fi

        # Login to Cloudflare
        echo "🔐 Logging into Cloudflare..."
        wrangler login

        echo "✅ Cloudflare setup complete!"
        echo ""
        echo "🚀 Deploy commands:"
        echo "   wrangler pages deploy out/ --compatibility-date=2024-01-01"
        echo "   wrangler pages deploy out/ --production"
        ;;

    "vercel")
        echo "▲ Setting up Vercel deployment..."

        # Check if vercel.json exists
        if [ ! -f "vercel.json" ]; then
            echo "📝 Creating vercel.json..."
            cat > vercel.json << 'EOF'
{
  "buildCommand": "pnpm build",
  "outputDirectory": "out",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "pages/api/**/*.js": {
      "runtime": "nodejs20.x"
    }
  }
}
EOF
            echo "✅ Created vercel.json"
        fi

        echo "✅ Vercel setup complete!"
        echo ""
        echo "🚀 Deploy commands:"
        echo "   vercel --prod"
        echo "   vercel deploy --prebuilt"
        ;;

    "docker")
        echo "🐳 Setting up Docker deployment..."

        # Check if docker-compose.yml exists
        if [ ! -f "docker-compose.yml" ]; then
            echo "📝 Creating docker-compose.yml..."
            cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [app]
EOF
            echo "✅ Created docker-compose.yml"
        fi

        echo "✅ Docker setup complete!"
        echo ""
        echo "🚀 Deploy commands:"
        echo "   docker-compose up -d --build"
        echo "   docker-compose logs -f"
        ;;
esac

# Create .env.example if it doesn't exist
if [ ! -f ".env.example" ]; then
    echo "📝 Creating .env.example..."
    cat > .env.example << 'EOF'
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/db
UPSTASH_REDIS_REST_URL=https://redis-url
EOF
    echo "✅ Created .env.example"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy .env.example to .env.local (for local dev)"
echo "2. Update all environment variables with real values"
echo "3. Run the deployment command for your platform"
echo "4. Test your deployed application"
echo ""
echo "📚 For detailed instructions, see:"
echo "   _docs/_deploy/$PLATFORM.md"
