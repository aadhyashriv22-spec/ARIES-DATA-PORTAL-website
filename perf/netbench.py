"""ARIES Observe network / resource benchmark.

Runs load phases against the local stack (main site :5000 -> gateway :4000
-> propagation :8000) while probing latency and sampling per-process
CPU / memory / threads / sockets / IO plus host CPU and NIC throughput.

Writes perf/results/bench-<timestamp>.json, which report.html renders.

Usage:  /home/user/miniconda3/envs/ssa/bin/python perf/netbench.py [--phase-seconds 25] [--no-public]
"""
import argparse
import asyncio
import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path

import httpx
import psutil
import websockets

ROOT = Path(__file__).resolve().parent
LOCAL = "http://127.0.0.1:5000"
PUBLIC = "https://www.aries-ssa.com"
OBSERVER = "lat=29.36&lon=79.46&alt=1.9"   # ARIES Nainital
DOWNLOAD_PATH = "andor_ultra_EMCCD_888/May/Cosmos2251/burst/COSMOS2251.fits"
SAMPLE_INTERVAL = 0.5
PROBE_INTERVAL = 0.5

SERVICES = {
    "main-site (node :5000)": lambda p: "backend/server.js" in " ".join(p.cmdline()),
    "gateway (node :4000)": lambda p: p.cmdline()[-1:] == ["server.js"] and "node_gateway" in (p.cwd() or ""),
    "propagation (python :8000)": lambda p: "uvicorn" in " ".join(p.cmdline()),
    "cloudflared tunnel": lambda p: "cloudflared" in p.name(),
    "tle scheduler": lambda p: "scheduler.py" in " ".join(p.cmdline()),
}


def load_env():
    env = {}
    for line in (ROOT.parent / "backend" / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def find_services():
    found = {}
    for p in psutil.process_iter():
        try:
            for label, match in SERVICES.items():
                if label not in found and match(p):
                    found[label] = p
        except (psutil.Error, IndexError):
            continue
    return found


def bundle_assets():
    """Asset URLs the visualizer page pulls on first load (from the built index.html)."""
    dist = ROOT.parent / "satelliteVisualizer" / "frontend" / "dist"
    html = (dist / "index.html").read_text()
    import re
    assets = re.findall(r'(?:src|href)="(/visualizer/[^"]+)"', html)
    assets.append("/visualizer/earth-blue-marble.jpg")
    return assets


# --------------------------------------------------------------- sampler
class Sampler(threading.Thread):
    def __init__(self, procs):
        super().__init__(daemon=True)
        self.procs = procs
        self.samples = []
        self.phase = "init"
        self.stop = threading.Event()

    def run(self):
        for p in self.procs.values():
            try:
                p.cpu_percent(None)
            except psutil.Error:
                pass
        psutil.cpu_percent(None, percpu=True)
        last_net = psutil.net_io_counters(pernic=True)
        last_io = {}
        last_t = time.time()
        while not self.stop.is_set():
            time.sleep(SAMPLE_INTERVAL)
            now = time.time()
            dt = now - last_t
            net = psutil.net_io_counters(pernic=True)
            nic = {}
            for name in ("lo", "eno2"):
                if name in net and name in last_net:
                    nic[name] = {
                        "tx_mbps": (net[name].bytes_sent - last_net[name].bytes_sent) * 8 / dt / 1e6,
                        "rx_mbps": (net[name].bytes_recv - last_net[name].bytes_recv) * 8 / dt / 1e6,
                    }
            per_proc = {}
            for label, p in self.procs.items():
                try:
                    with p.oneshot():
                        io = p.io_counters() if hasattr(p, "io_counters") else None
                        conns = p.net_connections(kind="tcp")
                        prev = last_io.get(label)
                        rd = wr = 0.0
                        if io and prev:
                            rd = (io.read_chars - prev.read_chars) / dt / 1e6
                            wr = (io.write_chars - prev.write_chars) / dt / 1e6
                        if io:
                            last_io[label] = io
                        per_proc[label] = {
                            "pid": p.pid,
                            "cpu": p.cpu_percent(None),
                            "rss_mb": p.memory_info().rss / 1e6,
                            "threads": p.num_threads(),
                            "fds": p.num_fds(),
                            "tcp": len(conns),
                            "tcp_established": sum(c.status == "ESTABLISHED" for c in conns),
                            # read/write_chars include socket traffic, so this is the
                            # best per-process network proxy without root/eBPF.
                            "io_read_MBps": rd,
                            "io_write_MBps": wr,
                        }
                except psutil.Error:
                    continue
            cores = psutil.cpu_percent(None, percpu=True)
            self.samples.append({
                "t": now,
                "phase": self.phase,
                "cpu_total": sum(cores) / len(cores),
                "cpu_max_core": max(cores),
                "load1": os.getloadavg()[0],
                "mem_used_pct": psutil.virtual_memory().percent,
                "nic": nic,
                "procs": per_proc,
            })
            last_net, last_t = net, now


# --------------------------------------------------------------- probes
async def timed_get(client, url, read_body=True):
    t0 = time.perf_counter()
    try:
        async with client.stream("GET", url) as r:
            ttfb = time.perf_counter() - t0
            n = 0
            if read_body:
                async for chunk in r.aiter_raw():
                    n += len(chunk)
            return {"ok": r.status_code < 400, "status": r.status_code,
                    "ttfb_ms": ttfb * 1e3, "total_ms": (time.perf_counter() - t0) * 1e3, "bytes": n}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "ttfb_ms": None,
                "total_ms": (time.perf_counter() - t0) * 1e3, "bytes": 0}


async def ws_first_frame(base):
    url = base.replace("http", "ws", 1) + "/visualizer-ws/global"
    t0 = time.perf_counter()
    try:
        async with websockets.connect(url, max_size=None, open_timeout=15) as ws:
            connected = time.perf_counter() - t0
            msg = await asyncio.wait_for(ws.recv(), timeout=30)
            return {"ok": True, "connect_ms": connected * 1e3,
                    "total_ms": (time.perf_counter() - t0) * 1e3, "bytes": len(msg)}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "total_ms": (time.perf_counter() - t0) * 1e3}


async def probe_loop(base, phase_ref, out, stop, include_heavy=True):
    """Small, frequent requests measuring how responsive each component stays."""
    targets = {
        "landing page /": "/",
        "visualizer shell /visualizer/": "/visualizer/",
        "visible API (radar)": f"/visualizer-api/visible?{OBSERVER}",
        "static css": "/css/landing.css",
    }
    async with httpx.AsyncClient(base_url=base, timeout=60, http2=False) as client:
        while not stop.is_set():
            for name, path in targets.items():
                r = await timed_get(client, path)
                r.update(t=time.time(), phase=phase_ref[0], target=name)
                out.append(r)
            if include_heavy:
                r = await ws_first_frame(base)
                r.update(t=time.time(), phase=phase_ref[0], target="WS first frame")
                out.append(r)
            await asyncio.sleep(PROBE_INTERVAL)


async def full_page_load(base, assets):
    """Cold load of every visualizer asset over 6 parallel connections, like a browser."""
    t0 = time.perf_counter()
    limits = httpx.Limits(max_connections=6)
    async with httpx.AsyncClient(base_url=base, timeout=120, limits=limits,
                                 headers={"Accept-Encoding": "gzip, br, zstd"}) as client:
        res = await asyncio.gather(*(timed_get(client, a) for a in ["/visualizer/"] + assets))
    return {"total_ms": (time.perf_counter() - t0) * 1e3,
            "bytes": sum(r["bytes"] for r in res),
            "ok": all(r["ok"] for r in res),
            "slowest": max(res, key=lambda r: r["total_ms"])["total_ms"]}


# --------------------------------------------------------------- load generators
async def ws_viewer(base, stop, stats):
    url = base.replace("http", "ws", 1) + "/visualizer-ws/global"
    try:
        async with websockets.connect(url, max_size=None, open_timeout=15) as ws:
            last = time.perf_counter()
            while not stop.is_set():
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                except asyncio.TimeoutError:
                    stats["stalls"] += 1
                    continue
                now = time.perf_counter()
                stats["bytes"] += len(msg)
                stats["frames"] += 1
                stats["intervals_ms"].append((now - last) * 1e3)
                last = now
    except Exception as e:
        stats["errors"].append(type(e).__name__)


async def radar_viewer(base, stop, stats):
    async with httpx.AsyncClient(base_url=base, timeout=120) as client:
        async def visible():
            while not stop.is_set():
                r = await timed_get(client, f"/visualizer-api/visible?{OBSERVER}")
                stats["visible_ms"].append(r["total_ms"])
                stats["bytes"] += r["bytes"]
                await asyncio.sleep(1)

        async def passes():
            while not stop.is_set():
                r = await timed_get(client, f"/visualizer-api/passes?{OBSERVER}")
                stats["passes_ms"].append(r["total_ms"])
                stats["bytes"] += r["bytes"]
                await asyncio.sleep(10)
        await asyncio.gather(visible(), passes())


async def portal_download(base, auth, stop, stats):
    url = f"/local/download?path={DOWNLOAD_PATH}"
    async with httpx.AsyncClient(base_url=base, timeout=60, auth=auth) as client:
        while not stop.is_set():
            t0 = time.perf_counter()
            try:
                async with client.stream("GET", url) as r:
                    stats["status"] = r.status_code
                    async for chunk in r.aiter_raw(1 << 20):
                        stats["bytes"] += len(chunk)
                        if stop.is_set():
                            break
            except Exception as e:
                stats["errors"].append(type(e).__name__)
                await asyncio.sleep(1)
            stats["seconds"] += time.perf_counter() - t0


def new_stats(kind):
    if kind == "ws":
        return {"bytes": 0, "frames": 0, "stalls": 0, "intervals_ms": [], "errors": []}
    if kind == "radar":
        return {"bytes": 0, "visible_ms": [], "passes_ms": [], "errors": []}
    return {"bytes": 0, "seconds": 0.0, "status": None, "errors": []}


async def run_phase(name, base, seconds, ws_n, radar_n, dl_n, auth, sampler, phase_ref,
                    probes, assets, page_loads):
    print(f"[phase] {name}: ws={ws_n} radar={radar_n} downloads={dl_n} for {seconds}s", flush=True)
    phase_ref[0] = name
    sampler.phase = name
    stop = asyncio.Event()
    stats = {"ws": [new_stats("ws") for _ in range(ws_n)],
             "radar": [new_stats("radar") for _ in range(radar_n)],
             "download": [new_stats("dl") for _ in range(dl_n)]}
    tasks = [asyncio.create_task(ws_viewer(base, stop, s)) for s in stats["ws"]]
    tasks += [asyncio.create_task(radar_viewer(base, stop, s)) for s in stats["radar"]]
    tasks += [asyncio.create_task(portal_download(base, auth, stop, s)) for s in stats["download"]]
    probe_stop = asyncio.Event()
    probe_task = asyncio.create_task(probe_loop(base, phase_ref, probes, probe_stop))
    t0 = time.time()
    await asyncio.sleep(min(5, seconds / 3))           # let load ramp up
    pl = await full_page_load(base, assets)
    pl.update(phase=name)
    page_loads.append(pl)
    await asyncio.sleep(max(0, seconds - (time.time() - t0)))
    stop.set()
    probe_stop.set()
    if tasks:
        await asyncio.wait(tasks, timeout=20)
    for t in tasks:
        t.cancel()
    await asyncio.wait([probe_task], timeout=40)
    probe_task.cancel()
    dur = time.time() - t0
    return {"name": name, "base": base, "seconds": dur, "ws": ws_n, "radar": radar_n,
            "downloads": dl_n, "start": t0, "stats": stats}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase-seconds", type=int, default=25)
    ap.add_argument("--no-public", action="store_true")
    args = ap.parse_args()

    env = load_env()
    auth = (env["PORTAL_USERNAME"], env["ARIES_PASSWORD"])
    procs = find_services()
    print("services:", {k: p.pid for k, p in procs.items()}, flush=True)
    assets = bundle_assets()

    # static facts
    async with httpx.AsyncClient(base_url=LOCAL, timeout=60) as c:
        sizes = {}
        for name, path in {"/global (full catalogue JSON)": "/visualizer-api/global",
                           "/visible (radar, per poll)": f"/visualizer-api/visible?{OBSERVER}",
                           "/passes (radar, every 10 s)": f"/visualizer-api/passes?{OBSERVER}",
                           "visualizer JS bundle": assets[0] if assets else "/visualizer/",
                           "earth texture jpg": "/visualizer/earth-blue-marble.jpg",
                           "landing page": "/"}.items():
            r = await timed_get(c, path)
            sizes[name] = r
        for a in assets:
            r = await c.get(a)
            sizes.setdefault("_assets", {})[a] = {"bytes": len(r.content),
                                                  "encoding": r.headers.get("content-encoding"),
                                                  "cache": r.headers.get("cache-control")}
    ws_frame = await ws_first_frame(LOCAL)
    sizes["WS frame (pushed every 1 s)"] = ws_frame

    sampler = Sampler(procs)
    sampler.start()
    phase_ref = ["init"]
    probes, page_loads, phases = [], [], []
    S = args.phase_seconds
    plan = [
        ("1 idle baseline", LOCAL, S, 0, 0, 0),
        ("2 visualizer x3", LOCAL, S, 3, 0, 0),
        ("3 radar x3", LOCAL, S, 0, 3, 0),
        ("4 portal downloads x3", LOCAL, S, 0, 0, 3),
        ("5 all combined", LOCAL, S, 3, 3, 3),
        ("6 cool-down", LOCAL, 10, 0, 0, 0),
    ]
    if not args.no_public:
        plan += [
            ("7 public idle (via Cloudflare)", PUBLIC, 15, 0, 0, 0),
            ("8 public visualizer+download", PUBLIC, 20, 1, 0, 1),
        ]
    for name, base, sec, w, r, d in plan:
        phases.append(await run_phase(name, base, sec, w, r, d, auth, sampler, phase_ref,
                                      probes, assets, page_loads))
    sampler.stop.set()
    sampler.join()

    out = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "host": {"cpus": psutil.cpu_count(), "mem_gb": psutil.virtual_memory().total / 1e9,
                 "services": {k: p.pid for k, p in procs.items()}},
        "sizes": sizes, "phases": phases, "probes": probes,
        "page_loads": page_loads, "samples": sampler.samples,
    }
    (ROOT / "results").mkdir(exist_ok=True)
    path = ROOT / "results" / f"bench-{datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(json.dumps(out))
    (ROOT / "results" / "latest.json").write_text(json.dumps(out))
    print("wrote", path)


if __name__ == "__main__":
    asyncio.run(main())
