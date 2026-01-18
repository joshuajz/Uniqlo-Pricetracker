#!/bin/bash
# Uniqlo Price Tracker - Daily Scraper Cron Job
#
# Add to crontab with: crontab -e
# Run daily at 6:00 AM: 0 6 * * * /path/to/scraper/run_scraper.sh
#
# Example crontab entry:
# 0 6 * * * /home/user/Uniqlo-Pricetracker/scraper/run_scraper.sh >> /home/user/Uniqlo-Pricetracker/scraper/cron.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Scraper started at $(date)"
echo "=========================================="

# Run the scraper using uv
uv run main.py

EXIT_CODE=$?

echo "=========================================="
echo "Scraper finished at $(date) with exit code $EXIT_CODE"
echo "=========================================="

exit $EXIT_CODE
