"""Real-time monitor for the ARIES Observe stack.

Samples every server process (CPU, memory, threads, FDs, sockets), host CPU,
NIC throughput and live latency probes once a second, and streams them to a
local dashboard over Server-Sent Events.

Usage (from /home/user/Desktop/file-portal):
    /home/user/miniconda3/envs/ssa/bin/python perf/monitor.py [--port 8090]
then open http://127.0.0.1:8090
"""
import argparse
import json
import os
import queue
import re
import subprocess
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import psutil

from netbench import LOCAL, OBSERVER, find_services

ROOT = Path(__file__).resolve().parent
HISTORY_SECONDS = 15 * 60
TICK = 1.0

# Light probes: cheap pages every 2 s, the radar API every 5 s (it costs the
# propagation service real CPU, so it is sampled more gently).
PROBES = [
    ("landing page", "/", 2),
    ("visualizer shell", "/visualizer/", 2),
    ("radar /visible", f"/visualizer-api/visible?{OBSERVER}", 5),
]


class State:
    def __init__(self):
        self.history = deque(maxlen=int(HISTORY_SECONDS / TICK))
        self.latency = {name: None for name, _, _ in PROBES}
        self.lock = threading.Lock()
        self.subscribers = set()

    def publish(self, sample):
        with self.lock:
            self.history.append(sample)
            subs = list(self.subscribers)
        for q in subs:
            try:
                q.put_nowait(sample)
            except queue.Full:
                pass


STATE = State()


def count_conns(port, status="ESTABLISHED"):
    """Established TCP connections whose local port is `port` (inbound clients)."""
    n = 0
    for c in psutil.net_connections(kind="tcp"):
        if c.laddr and c.laddr.port == port and c.status == status:
            n += 1
    return n


_ws_hist = deque(maxlen=4)   # last few {peer: bytes_acked} snapshots (~3 s)


def streaming_viewers():
    """Connections on :8000 that received >1 MB over the last ~3 s.

    Every open visualizer tab holds a WebSocket that gets a multi-MB frame
    about once a second; idle keep-alive sockets (gateway -> Python HTTP
    pool) stay near zero, so a byte-rate threshold separates the two.
    """
    try:
        out = subprocess.run(["ss", "-tnHi", "state", "established", "( sport = :8000 )"],
                             capture_output=True, text=True, timeout=2).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    now, peer = {}, None
    for line in out.splitlines():
        if not line.startswith(("\t", " ")):
            parts = line.split()
            peer = parts[-1] if parts else None
        elif peer:
            m = re.search(r"bytes_acked:(\d+)", line)
            if m:
                now[peer] = int(m.group(1))
    _ws_hist.append(now)
    oldest = _ws_hist[0]
    return sum(1 for k, v in now.items() if v - oldest.get(k, v) > 1_000_000)


def sampler():
    procs = find_services()
    for p in procs.values():
        try:
            p.cpu_percent(None)
        except psutil.Error:
            pass
    psutil.cpu_percent(None, percpu=True)
    last_net, last_t = psutil.net_io_counters(pernic=True), time.time()
    last_io = {}
    last_refind = time.time()
    while True:
        time.sleep(TICK)
        now = time.time()
        dt = now - last_t
        # Pick up restarted services (new PIDs) every 30 s.
        if now - last_refind > 30:
            fresh = find_services()
            for k, p in fresh.items():
                if k not in procs or procs[k].pid != p.pid:
                    procs[k] = p
                    try:
                        p.cpu_percent(None)
                    except psutil.Error:
                        pass
            last_refind = now
        net = psutil.net_io_counters(pernic=True)
        nic = {}
        for name in ("eno2", "lo"):
            if name in net and name in last_net:
                nic[name] = {
                    "tx": (net[name].bytes_sent - last_net[name].bytes_sent) * 8 / dt / 1e6,
                    "rx": (net[name].bytes_recv - last_net[name].bytes_recv) * 8 / dt / 1e6,
                }
        out = {}
        for label, p in list(procs.items()):
            try:
                with p.oneshot():
                    io = p.io_counters()
                    prev = last_io.get(label)
                    wr = (io.write_chars - prev.write_chars) * 8 / dt / 1e6 if prev else 0.0
                    last_io[label] = io
                    conns = p.net_connections(kind="tcp")
                    out[label] = {
                        "pid": p.pid, "alive": True,
                        "cpu": round(p.cpu_percent(None), 1),
                        "rss": round(p.memory_info().rss / 1e6, 1),
                        "threads": p.num_threads(), "fds": p.num_fds(),
                        "tcp": sum(c.status == "ESTABLISHED" for c in conns),
                        "write_mbps": round(wr, 1),
                    }
            except psutil.Error:
                out[label] = {"pid": p.pid, "alive": False}
        cores = psutil.cpu_percent(None, percpu=True)
        try:
            site_conns = count_conns(5000)
        except psutil.Error:
            site_conns = None
        ws_viewers = streaming_viewers()
        with STATE.lock:
            latency = dict(STATE.latency)
        STATE.publish({
            "t": now,
            "host": {"cpu": round(sum(cores) / len(cores), 1), "max_core": round(max(cores), 1),
                     "load1": round(os.getloadavg()[0], 2),
                     "mem_pct": psutil.virtual_memory().percent},
            "nic": {k: {kk: round(vv, 2) for kk, vv in v.items()} for k, v in nic.items()},
            "procs": out,
            "conns": {"site": site_conns, "ws_to_python": ws_viewers},
            "latency": latency,
        })
        last_net, last_t = net, now


def prober(name, path, every):
    with httpx.Client(base_url=LOCAL, timeout=60) as client:
        while True:
            t0 = time.perf_counter()
            try:
                r = client.get(path)
                ms = (time.perf_counter() - t0) * 1e3 if r.status_code < 500 else None
            except httpx.HTTPError:
                ms = None
            with STATE.lock:
                STATE.latency[name] = None if ms is None else round(ms, 1)
            time.sleep(max(0.0, every - (time.perf_counter() - t0)))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with STATE.lock:
                history = json.dumps(list(STATE.history))
            # Inline recent history so the page paints with data immediately.
            body = (ROOT / "monitor.html").read_text().replace(
                "/*__HISTORY__*/[]", history).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/events":
            self.stream()
        else:
            self.send_error(404)

    def stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        q = queue.Queue(maxsize=120)
        with STATE.lock:
            backlog = list(STATE.history)
            STATE.subscribers.add(q)
        try:
            self.wfile.write(b"event: history\ndata: " + json.dumps(backlog).encode() + b"\n\n")
            self.wfile.flush()
            while True:
                sample = q.get()
                self.wfile.write(b"data: " + json.dumps(sample).encode() + b"\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with STATE.lock:
                STATE.subscribers.discard(q)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8090)
    args = ap.parse_args()
    threading.Thread(target=sampler, daemon=True).start()
    for name, path, every in PROBES:
        threading.Thread(target=prober, args=(name, path, every), daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    print(f"Monitor running at http://127.0.0.1:{args.port}  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
