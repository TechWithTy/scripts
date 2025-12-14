#!/bin/bash

# Docker Build + Cloudflare Pages Deployment Script
# This script builds the Next.js app using Docker and deploys to Cloudflare Pages

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="dealscale"
DOCKER_IMAGE="dealscale-pages"
DOCKERFILE_PATH="Dockerfile.pages"
OUTPUT_DIR="cloudflare-output"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANDING_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${LANDING_DIR}/.." && pwd)"

# Functions
print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed. Install with: npm install -g wrangler"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Clean up function
cleanup() {
    print_info "Cleaning up..."
    
    # Remove temporary container if it exists
    if docker ps -a --format '{{.Names}}' | grep -q "^temp-${PROJECT_NAME}$"; then
        docker rm -f "temp-${PROJECT_NAME}" 2>/dev/null || true
    fi
    
    # Remove output directory if it exists
    if [ -d "${PROJECT_ROOT}/${OUTPUT_DIR}" ]; then
        rm -rf "${PROJECT_ROOT}/${OUTPUT_DIR}"
    fi
}

# Build Docker image
build_docker_image() {
    print_info "Building Docker image: ${DOCKER_IMAGE}..."
    
    cd "${PROJECT_ROOT}"
    
    # Check if root package.json exists (monorepo) or use standalone build
    if [ -f "${PROJECT_ROOT}/package.json" ] && [ -f "${PROJECT_ROOT}/pnpm-workspace.yaml" ]; then
        # Monorepo build - use root as context
        print_info "Detected monorepo structure"
        BUILD_CONTEXT="${PROJECT_ROOT}"
        DOCKERFILE="${PROJECT_ROOT}/landing/Dockerfile.pages"
    else
        # Standalone build - use landing directory as context
        print_info "Detected standalone structure - building from landing directory"
        BUILD_CONTEXT="${LANDING_DIR}"
        DOCKERFILE="${LANDING_DIR}/Dockerfile.pages.standalone"
        
        if [ ! -f "${DOCKERFILE}" ]; then
            print_warning "Standalone Dockerfile not found, using standard Dockerfile.pages"
            DOCKERFILE="${LANDING_DIR}/Dockerfile.pages"
        fi
    fi
    
    # Verify landing package.json exists
    if [ ! -f "${LANDING_DIR}/package.json" ]; then
        print_error "landing/package.json not found at: ${LANDING_DIR}/package.json"
        exit 1
    fi
    
    print_info "Build context: ${BUILD_CONTEXT}"
    print_info "Dockerfile: ${DOCKERFILE}"
    
    cd "${BUILD_CONTEXT}"
    
    docker build \
        -f "${DOCKERFILE}" \
        -t "${DOCKER_IMAGE}:latest" \
        --build-arg NODE_ENV=production \
        .
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully"
    else
        print_error "Docker build failed"
        exit 1
    fi
}

# Extract build output
extract_output() {
    print_info "Extracting build output..."
    
    cd "${PROJECT_ROOT}"
    
    # Remove old output directory if it exists
    if [ -d "${OUTPUT_DIR}" ]; then
        rm -rf "${OUTPUT_DIR}"
    fi
    
    # Create temporary container
    docker create --name "temp-${PROJECT_NAME}" "${DOCKER_IMAGE}:latest"
    
    # Create output directory
    mkdir -p "${OUTPUT_DIR}"
    
    # Copy output from container
    docker cp "temp-${PROJECT_NAME}:/output" "${OUTPUT_DIR}"
    
    # Clean up container
    docker rm "temp-${PROJECT_NAME}"
    
    # Verify output
    if [ -f "${OUTPUT_DIR}/index.html" ] || [ -d "${OUTPUT_DIR}/_next" ]; then
        print_success "Build output extracted successfully"
        print_info "Output directory: ${PROJECT_ROOT}/${OUTPUT_DIR}"
    else
        print_error "Build output is missing or invalid"
        exit 1
    fi
}

# Deploy to Cloudflare Pages
deploy_to_cloudflare() {
    local deploy_env="${1:-production}"
    
    print_info "Deploying to Cloudflare Pages (${deploy_env})..."
    
    cd "${PROJECT_ROOT}/${OUTPUT_DIR}"
    
    if [ "$deploy_env" = "production" ]; then
        wrangler pages deploy . \
            --project-name="${PROJECT_NAME}" \
            --production
    else
        wrangler pages deploy . \
            --project-name="${PROJECT_NAME}"
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Deployed to Cloudflare Pages successfully"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Main execution
main() {
    local deploy_env="${1:-production}"
    
    print_info "Starting Docker build + Cloudflare Pages deployment"
    print_info "Project: ${PROJECT_NAME}"
    print_info "Environment: ${deploy_env}"
    echo ""
    
    # Trap to ensure cleanup on exit
    trap cleanup EXIT
    
    # Run steps
    check_prerequisites
    echo ""
    
    build_docker_image
    echo ""
    
    extract_output
    echo ""
    
    deploy_to_cloudflare "${deploy_env}"
    echo ""
    
    print_success "Deployment completed successfully!"
    print_info "Your site should be live at: https://${PROJECT_NAME}.pages.dev"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [production|preview]"
        echo ""
        echo "Options:"
        echo "  production  Deploy to production (default)"
        echo "  preview     Deploy to preview environment"
        echo "  --help, -h  Show this help message"
        exit 0
        ;;
    preview)
        main "preview"
        ;;
    production|"")
        main "production"
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

