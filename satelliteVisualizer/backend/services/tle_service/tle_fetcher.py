import json
import os
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
BACKEND_DIR = BASE_DIR.parent.parent  # satelliteVisualizer/backend
load_dotenv(BACKEND_DIR / ".env")

SPACE_TRACK_USERNAME = os.environ.get("SPACE_TRACK_USERNAME")
SPACE_TRACK_PASSWORD = os.environ.get("SPACE_TRACK_PASSWORD")

SPACETRACK_LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
# GP is Space-Track's current general-perturbations class (the documented
# replacement for the legacy tle/tle_latest classes). This query mirrors
# what CelesTrak's GROUP=active represented — every currently on-orbit,
# currently-tracked object — via DECAY_DATE/null-val (excludes objects
# already marked decayed) and EPOCH/>now-30 (excludes elements stale
# enough that they're no longer being actively updated). format/3le
# returns the exact name+line1+line2 text layout load_tles() already
# parses, so no parser/propagation changes are needed downstream.
SPACETRACK_QUERY_URL = (
    "https://www.space-track.org/basicspacedata/query/class/gp/"
    "DECAY_DATE/null-val/EPOCH/%3Enow-30/orderby/NORAD_CAT_ID/format/3le"
)

# Below this, a response is treated as invalid/unusable rather than a
# genuine (if unusually small) catalogue — comfortably under any real
# response (CelesTrak's equivalent active-satellite feed runs ~14,000),
# but high enough to catch an empty/near-empty/error response.
MINIMUM_SATELLITE_COUNT = 100

STORAGE_DIR = BASE_DIR.parent / "storage"
TLE_PATH = STORAGE_DIR / "active.tle"
ARCHIVE_DIR = STORAGE_DIR / "archive"
MANIFEST_PATH = ARCHIVE_DIR / "manifest.jsonl"


def _count_valid_tles(text: str) -> int:
    """Counts name+line1+line2 triples that look like real TLE data.

    Mirrors propagation_service's own load_tles() triple-detection
    (line1 starts with "1 ", line2 starts with "2 ") without importing
    across the two independently-deployed services — this stays a
    validation gate in the fetcher, not a shared dependency.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    count = 0
    for i in range(0, len(lines) - 2, 3):
        if lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
            count += 1
    return count


def _archive_catalogue(content: bytes, fetched_at: datetime, satellite_count: int) -> Path:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{fetched_at.strftime('%Y%m%dT%H%M%SZ')}.tle"
    archive_path = ARCHIVE_DIR / filename

    # Same tmp-then-rename pattern as active.tle: never leaves a partially
    # written file at the final archive path.
    tmp_path = archive_path.with_suffix(".tmp")
    tmp_path.write_bytes(content)
    tmp_path.replace(archive_path)

    manifest_entry = {
        "filename": filename,
        "fetched_at": fetched_at.isoformat(),
        "satellite_count": satellite_count,
        "size_bytes": len(content),
        "source": "space-track",
    }
    # Whole-file tmp-then-rename (not a plain append): guarantees the
    # manifest can never be left half-written even if the process is
    # killed mid-write. Only one process (the scheduler) ever calls this,
    # so there's no concurrent-writer race to account for.
    existing = MANIFEST_PATH.read_text(encoding="utf-8") if MANIFEST_PATH.exists() else ""
    manifest_tmp = MANIFEST_PATH.with_suffix(".tmp")
    manifest_tmp.write_text(existing + json.dumps(manifest_entry) + "\n", encoding="utf-8")
    manifest_tmp.replace(MANIFEST_PATH)

    return archive_path


def _fail(reason: str) -> bool:
    print("Space-Track fetch failed:", reason)
    print("active.tle unchanged")
    print("Historical archive unchanged")
    return False


def _space_track_login() -> requests.Session:
    session = requests.Session()
    response = session.post(
        SPACETRACK_LOGIN_URL,
        data={"identity": SPACE_TRACK_USERNAME, "password": SPACE_TRACK_PASSWORD},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"login request failed: HTTP {response.status_code}")
    return session


def fetch_tle():
    if not SPACE_TRACK_USERNAME or not SPACE_TRACK_PASSWORD:
        return _fail("SPACE_TRACK_USERNAME/SPACE_TRACK_PASSWORD not configured")

    print("Fetching TLE catalogue from Space-Track...")

    try:
        session = _space_track_login()
    except (requests.RequestException, RuntimeError) as e:
        return _fail(str(e))

    print("Authentication successful")

    try:
        response = session.get(SPACETRACK_QUERY_URL, timeout=60)
    except requests.RequestException as e:
        return _fail(str(e))
    finally:
        session.close()

    if response.status_code != 200:
        return _fail(f"HTTP {response.status_code}")

    text = response.text
    # A failed/expired login on the query step (as opposed to the login
    # step itself) typically comes back as an HTML page, not TLE text —
    # this catches that case with a clear message instead of it silently
    # falling through to "0 valid satellites".
    if text.strip()[:1] == "<":
        return _fail("response looks like an HTML page, not TLE data (likely an authentication or query error)")

    satellite_count = _count_valid_tles(text)
    if satellite_count < MINIMUM_SATELLITE_COUNT:
        return _fail(
            f"catalogue invalid or too small ({satellite_count} valid entries, "
            f"expected at least {MINIMUM_SATELLITE_COUNT})"
        )

    print(f"Downloaded {satellite_count} satellites")
    print("Catalogue validated")

    content = response.content

    if TLE_PATH.exists() and TLE_PATH.read_bytes() == content:
        print("Catalogue unchanged")
        return True

    print("New catalogue detected")

    fetched_at = datetime.now(timezone.utc)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Archive first: every successfully validated, genuinely-new fetch is
    # preserved permanently before active.tle is touched, so active.tle
    # can never point at content that isn't also recoverable from the
    # archive.
    archive_path = _archive_catalogue(content, fetched_at, satellite_count)
    print("Archived:", archive_path.name)

    tmp_path = TLE_PATH.with_suffix(".tmp")
    tmp_path.write_bytes(content)
    tmp_path.replace(TLE_PATH)
    print("Updated active.tle")

    return True


if __name__ == "__main__":
    fetch_tle()
