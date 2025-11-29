#!/bin/bash

# Script to download case study thumbnails from Unsplash
# These are high-quality, free stock images that match each case study theme

echo "Downloading case study thumbnails..."

# Create directories if they don't exist
mkdir -p public/case-studies
mkdir -p public/images

# 1. GlobalConsult - Lead automation/consulting theme
# Business meeting, professional consulting
echo "Downloading GlobalConsult thumbnail..."
curl -L "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=800&fit=crop&auto=format" \
  -o "public/case-studies/globalconsult-lead-automation.png" \
  --fail --silent --show-error

# 2. BetaCorp CRM Integration - CRM dashboard theme
# CRM dashboard, business analytics
echo "Downloading BetaCorp hero image..."
curl -L "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&fit=crop&auto=format" \
  -o "public/images/case-betacorp-crm-hero.jpg" \
  --fail --silent --show-error

echo "Downloading BetaCorp thumbnail..."
curl -L "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop&auto=format" \
  -o "public/images/case-betacorp-crm-thumb.jpg" \
  --fail --silent --show-error

# 3. Gamma Full Automation - Automation/workflow theme
# Automation, workflow, technology
echo "Downloading Gamma hero image..."
curl -L "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&h=800&fit=crop&auto=format" \
  -o "public/images/case-gamma-automation-hero.jpg" \
  --fail --silent --show-error

echo "Downloading Gamma thumbnail..."
curl -L "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=400&fit=crop&auto=format" \
  -o "public/images/case-gamma-automation-thumb.jpg" \
  --fail --silent --show-error

# 4. REI Operator - Real estate investment theme
# Real estate, property, investment
echo "Downloading REI Operator thumbnail..."
curl -L "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&h=800&fit=crop&auto=format" \
  -o "public/case-studies/rei-operator-deal-flow.png" \
  --fail --silent --show-error

echo "All thumbnails downloaded successfully!"
echo ""
echo "Downloaded images:"
echo "  - public/case-studies/globalconsult-lead-automation.png"
echo "  - public/images/case-betacorp-crm-hero.jpg"
echo "  - public/images/case-betacorp-crm-thumb.jpg"
echo "  - public/images/case-gamma-automation-hero.jpg"
echo "  - public/images/case-gamma-automation-thumb.jpg"
echo "  - public/case-studies/rei-operator-deal-flow.png"


