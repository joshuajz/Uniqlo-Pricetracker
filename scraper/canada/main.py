"""Run the low-traffic Uniqlo Canada API scraper."""

from pathlib import Path
import sys


SCRAPER_ROOT = Path(__file__).resolve().parents[1]
if str(SCRAPER_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRAPER_ROOT))

from canada.config import CONFIG  # noqa: E402
from core import run  # noqa: E402


if __name__ == "__main__":
    run(CONFIG, Path(__file__).resolve().parent)
