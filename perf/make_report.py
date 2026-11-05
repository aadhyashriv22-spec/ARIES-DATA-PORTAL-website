"""Render perf/results/latest.json (from netbench.py) into perf/report.html.

The report is a single self-contained local file (data inlined, no CDN),
meant to be opened directly from disk: xdg-open perf/report.html
"""
import json
import statistics as st
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "results" / "latest.json"
d = json.loads(src.read_text())


def pct(a, q):
    a = sorted(x for x in a if x is not None)
    return a[min(len(a) - 1, int(q * len(a)))] if a else None


phases = [p["name"] for p in d["phases"]]
t0 = d["phases"][0]["start"]

# ---- latency matrix (probe target x phase) -------------------------------
targets = ["landing page /", "visualizer shell /visualizer/", "static css",
           "visible API (radar)", "WS first frame"]
lat = []
for t in targets:
    row = []
    for ph in phases:
        v = [x["total_ms"] for x in d["probes"] if x["phase"] == ph and x["target"] == t]
        fails = sum(1 for x in d["probes"] if x["phase"] == ph and x["target"] == t and not x["ok"])
        row.append({"p50": pct(v, .5), "p95": pct(v, .95), "n": len(v), "fail": fails})
    lat.append({"target": t, "cells": row})

# ---- load generator outcomes per phase -----------------------------------
gen = []
for p in d["phases"]:
    s, sec = p["stats"], p["seconds"]
    ws = s["ws"]
    radar = s["radar"]
    dl = s["download"]
    iv = [i for w in ws for i in w["intervals_ms"]]
    gen.append({
        "phase": p["name"], "base": p["base"],
        "ws_n": len(ws),
        "ws_mbps_each": st.mean(w["bytes"] * 8 / sec / 1e6 for w in ws) if ws else None,
        "ws_frames_per_s": st.mean(w["frames"] / sec for w in ws) if ws else None,
        "ws_interval_p50": pct(iv, .5), "ws_stalls": sum(w["stalls"] for w in ws) if ws else None,
        "radar_n": len(radar),
        "visible_p50": pct([v for r in radar for v in r["visible_ms"]], .5),
        "visible_p95": pct([v for r in radar for v in r["visible_ms"]], .95),
        "visible_polls_per_s": (sum(len(r["visible_ms"]) for r in radar) / sec / len(radar)) if radar else None,
        "passes_max": max([v for r in radar for v in r["passes_ms"]], default=None),
        "passes_done": sum(len(r["passes_ms"]) for r in radar) if radar else None,
        "dl_n": len(dl),
        "dl_mbps_each": st.mean(x["bytes"] * 8 / sec / 1e6 for x in dl) if dl else None,
    })

# ---- per-process table per phase -----------------------------------------
proc_names = list(d["samples"][0]["procs"].keys())
proc_tab = []
for ph in phases:
    sm = [x for x in d["samples"] if x["phase"] == ph]
    for k in proc_names:
        rows = [x["procs"][k] for x in sm if k in x["procs"]]
        if not rows:
            continue
        proc_tab.append({
            "phase": ph, "proc": k, "pid": rows[-1]["pid"],
            "cpu_avg": st.mean(r["cpu"] for r in rows), "cpu_max": max(r["cpu"] for r in rows),
            "rss": max(r["rss_mb"] for r in rows), "threads": rows[-1]["threads"],
            "fds": max(r["fds"] for r in rows), "tcp": max(r["tcp"] for r in rows),
            "io_w": st.mean(r["io_write_MBps"] for r in rows),
        })

# ---- time series (downsampled to keep the file small) --------------------
series = {"t": [], "phase": [], "cpu": {k: [] for k in proc_names}, "rss": {k: [] for k in proc_names},
          "tcp": {k: [] for k in proc_names}, "io_w": {k: [] for k in proc_names},
          "eno2_tx": [], "lo_tx": [], "host_cpu": [], "max_core": []}
for x in d["samples"]:
    series["t"].append(round(x["t"] - t0, 2))
    series["phase"].append(x["phase"])
    for k in proc_names:
        p = x["procs"].get(k, {})
        series["cpu"][k].append(round(p.get("cpu", 0), 1))
        series["rss"][k].append(round(p.get("rss_mb", 0), 1))
        series["tcp"][k].append(p.get("tcp", 0))
        series["io_w"][k].append(round(p.get("io_write_MBps", 0) * 8, 1))
    series["eno2_tx"].append(round(x["nic"].get("eno2", {}).get("tx_mbps", 0), 1))
    series["lo_tx"].append(round(x["nic"].get("lo", {}).get("tx_mbps", 0), 1))
    series["host_cpu"].append(round(x["cpu_total"], 1))
    series["max_core"].append(round(x["cpu_max_core"], 1))
bands = [{"name": p["name"], "start": p["start"] - t0, "end": p["start"] - t0 + p["seconds"]}
         for p in d["phases"]]

sizes = [{"name": k, "bytes": v.get("bytes"), "ms": v.get("total_ms")}
         for k, v in d["sizes"].items() if k != "_assets"]
assets = d["sizes"].get("_assets", {})

# ---- headline numbers ----------------------------------------------------
G = {g["phase"]: g for g in gen}
L = {r["target"]: {ph: c for ph, c in zip(phases, r["cells"])} for r in lat}
P = {(r["phase"], r["proc"]): r for r in proc_tab}
ws_frame_mb = d["sizes"]["WS frame (pushed every 1 s)"]["bytes"] / 1e6
prop = "propagation (python :8000)"
idle, viz, radar, dlp, comb = phases[0], phases[1], phases[2], phases[3], phases[4]
pub = [p for p in phases if p.startswith("8")]
pub_idle = [p for p in phases if p.startswith("7")]


def ms(v):
    if v is None:
        return "–"
    return f"{v/1000:.1f} s" if v >= 1000 else f"{v:.0f} ms"


tiles = [
    (f"{ws_frame_mb:.1f} MB", "pushed to every visualizer viewer, every frame",
     f"≈{G[viz]['ws_mbps_each']:.0f} Mbit/s per open tab, uncompressed JSON of all satellites"),
    (ms(L["visible API (radar)"][radar]["p50"]), "radar /visible latency while 3 radar pages are open",
     f"vs {ms(L['visible API (radar)'][idle]['p50'])} idle – blocked behind /passes"),
    (ms(G[comb]["passes_max"]), "slowest /passes response under combined load",
     f"{ms(d['sizes']['/passes (radar, every 10 s)']['total_ms'])} even with nobody else on; radar asks every 10 s"),
    (f"{P[(idle, prop)]['cpu_avg']:.0f}%", "propagation service CPU with zero visitors",
     "one Python process, effectively one core (GIL), 52 cores available"),
]
if pub:
    tiles.append((ms(L["landing page /"][pub[0]]["p50"]),
                  "public landing page while 1 viewer + 1 download share the tunnel",
                  f"vs {ms(L['landing page /'][pub_idle[0]]['p50'])} with the tunnel idle"))

data = {"phases": phases, "bands": bands, "lat": lat, "gen": gen, "proc_tab": proc_tab,
        "proc_names": proc_names, "series": series, "sizes": sizes, "assets": assets,
        "generated": d["generated"], "host": d["host"]}

tile_html = "".join(
    f'<div class="tile"><div class="big">{escape(a)}</div><div class="lbl">{escape(b)}</div>'
    f'<div class="sub">{escape(c)}</div></div>' for a, b, c in tiles)

tpl = (ROOT / "report_template.html").read_text()
out = (tpl.replace("/*__DATA__*/null", json.dumps(data))
          .replace("<!--__TILES__-->", tile_html)
          .replace("__GENERATED__", escape(d["generated"])))
(ROOT / "report.html").write_text(out)
print("wrote", ROOT / "report.html")
