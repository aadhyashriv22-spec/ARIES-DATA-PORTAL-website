from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pathlib import Path
from sgp4.api import Satrec
from .propagate import propagate_satellite, jd_to_datetime
from .observer import compute_az_el
from .classify import classify_orbit
from datetime import datetime, timedelta
import asyncio
import math

app = FastAPI()

state = {
    "global": [],
    "timestamp": None
}

state_lock = asyncio.Lock()
satellites = []
# Static, per-satellite metadata (NORAD ID, inclination, TLE epoch) that
# doesn't change second-to-second like position does — computed once when
# the catalogue loads instead of on every propagation tick. Keyed by name,
# kept as a side table so the (name, sat) tuples used everywhere else are
# unchanged.
satellite_metadata = {}
_tle_mtime = None

BASE_DIR = Path(__file__).resolve().parent.parent
TLE_PATH = BASE_DIR / "services" / "storage" / "active.tle"
TLE_RELOAD_CHECK_SECONDS = 60




def load_tles():
    lines = TLE_PATH.read_text().splitlines()
    sats = []
    metadata = {}

    cleaned = [line.strip() for line in lines if line.strip()]

    for i in range(0, len(cleaned) - 2, 3):
        name = cleaned[i]
        line1 = cleaned[i + 1]
        line2 = cleaned[i + 2]

        if line1.startswith("1 ") and line2.startswith("2 "):
            sat = Satrec.twoline2rv(line1, line2)
            sats.append((name, sat))
            # Keyed by object identity, not `name`: satellite names are
            # NOT unique in the live catalog (confirmed on the active
            # feed: e.g. two distinct satellites both named "OTTER", five
            # distinct ones all named "HULIANWANG JISHU SHIYAN*") — a
            # name-keyed dict would have every one of them silently
            # report the last-loaded satellite's norad_id instead of
            # their own. `sat` is a freshly constructed Satrec held alive
            # for this whole generation by `sats`/`satellites`, so id(sat)
            # is guaranteed unique and stable for as long as this
            # metadata dict is in use (both are discarded together on the
            # next TLE reload).
            metadata[id(sat)] = {
                "norad_id": sat.satnum,
                "inclination_deg": math.degrees(sat.inclo),
                "epoch": jd_to_datetime(sat.jdsatepoch, sat.jdsatepochF).isoformat(),
            }

    print("Loaded satellites:", len(sats))
    return sats, metadata




def compute_all_satellites(now):
    new_global = []

    for name, sat in satellites:
        data = propagate_satellite(sat, now)
        if data is None:
            continue

        orbit_type = classify_orbit(sat, data["alt"])
        meta = satellite_metadata.get(id(sat), {})

        new_global.append({
            "name": name,
            "lat": data["lat"],
            "lon": data["lon"],
            "alt_km": data["alt"],
            "ecef": list(data["ecef"]),  # ensure JSON serializable
            "orbit_type": orbit_type,
            "speed_km_s": data["speed_km_s"],
            "norad_id": meta.get("norad_id"),
            "inclination_deg": meta.get("inclination_deg"),
            "epoch": meta.get("epoch"),
        })

    return new_global


async def background_propagation():
    while True:
        now = datetime.utcnow()

        new_global = await asyncio.to_thread(compute_all_satellites, now)

        async with state_lock:
            state["global"] = new_global
            state["timestamp"] = now

        await asyncio.sleep(1)




async def watch_tle_file():
    global satellites, satellite_metadata, _tle_mtime

    while True:
        await asyncio.sleep(TLE_RELOAD_CHECK_SECONDS)

        try:
            mtime = TLE_PATH.stat().st_mtime
        except FileNotFoundError:
            continue

        if mtime == _tle_mtime:
            continue

        new_satellites, new_metadata = await asyncio.to_thread(load_tles)
        satellites = new_satellites
        satellite_metadata = new_metadata
        _tle_mtime = mtime
        print("Reloaded TLE catalog:", len(satellites), "satellites")


@app.on_event("startup")
async def startup_event():
    global satellites, satellite_metadata, _tle_mtime
    satellites, satellite_metadata = load_tles()
    _tle_mtime = TLE_PATH.stat().st_mtime
    asyncio.create_task(background_propagation())
    asyncio.create_task(watch_tle_file())




@app.websocket("/ws/global")
async def websocket_global(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connected")

    try:
        while True:
            async with state_lock:
                payload = {
                    "timestamp": state["timestamp"].isoformat() if state["timestamp"] else None,
                    "satellites": state["global"]
                }

            await websocket.send_json(payload)
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        print("WebSocket disconnected")

    except Exception as e:
        print("WebSocket error:", e)




@app.get("/global")
async def get_global():
    async with state_lock:
        return {
            "timestamp": state["timestamp"].isoformat() if state["timestamp"] else None,
            "satellites": state["global"]
        }


@app.get("/visible")
async def get_visible(lat: float, lon: float, alt: float = 0.0):
    result = []

    async with state_lock:
        global_snapshot = state["global"]

    for sat in global_snapshot:
        x, y, z = sat["ecef"]
        az, el = compute_az_el(x, y, z, lat, lon, alt)

        if 30 <= el <= 90:
            sat_copy = sat.copy()
            sat_copy["azimuth"] = az
            sat_copy["elevation"] = el
            result.append(sat_copy)

    return result




def visible_candidates(lat, margin_deg=2.0, max_candidates=1500):
    """Pre-filter satellites that could possibly pass overhead of `lat`.

    A satellite can only ever appear above a given latitude if its orbital
    inclination is at least that latitude (a standard astrodynamics
    result for near-circular orbits, which covers effectively the whole
    catalogue). `margin_deg` gives a small safety margin for edge cases
    and mild eccentricity. `max_candidates` is a last-resort safety valve
    for low-latitude observers, where the inclination filter alone
    barely narrows the catalogue (nearly every orbit qualifies near the
    equator) — it is not a blind truncation of the whole catalogue like
    the old fixed [:50], only of whatever remains after the real filter.
    """
    threshold = max(0.0, abs(lat) - margin_deg)
    candidates = [
        (name, sat) for name, sat in satellites
        if math.degrees(sat.inclo) >= threshold
    ]
    return candidates[:max_candidates]


def compute_passes(lat, lon, hours, alt=0.0):
    passes = []
    now = datetime.utcnow()
    end_time = now + timedelta(hours=hours)
    step = timedelta(seconds=60)

    for name, sat in visible_candidates(lat):
        t = now
        previous_el = None
        rise_time = None
        rise_in_progress = False
        max_el = -999
        max_time = None

        while t <= end_time:
            data = propagate_satellite(sat, t)
            if data is None:
                t += step
                continue

            x, y, z = data["ecef"]
            az, el = compute_az_el(x, y, z, lat, lon, alt)

            if previous_el is None and el >= 0:
                # Already above the horizon at the start of the window —
                # the actual rise happened before "now", but this pass is
                # genuinely in progress. Without this, the loop below only
                # ever fires on an observed 0-crossing, so an in-progress
                # pass's set time was silently never recorded at all (the
                # satellite just vanished from /passes until its *next*
                # full cycle, even though it's visible right now).
                rise_time = t
                rise_in_progress = True
                max_el = el
                max_time = t

            if previous_el is not None:
                if previous_el < 0 and el >= 0:
                    rise_time = t
                    rise_in_progress = False
                    max_el = el
                    max_time = t

                if rise_time and el > max_el:
                    max_el = el
                    max_time = t

                if rise_time and previous_el >= 0 and el < 0:
                    passes.append({
                        "name": name,
                        "rise_time": rise_time.isoformat(),
                        "already_visible_at_start": rise_in_progress,
                        "max_time": max_time.isoformat() if max_time else None,
                        "set_time": t.isoformat(),
                        "max_elevation": max_el
                    })
                    break

            previous_el = el
            t += step

    return passes


@app.get("/passes")
async def get_passes(lat: float, lon: float, hours: int = 24, alt: float = 0.0):
    return await asyncio.to_thread(compute_passes, lat, lon, hours, alt)