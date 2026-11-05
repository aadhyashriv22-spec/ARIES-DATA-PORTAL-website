import math
import numpy as np

R_EARTH = 6378.137

def compute_observer_ecef(lat_deg, lon_deg, alt_km=0.0):
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    r = R_EARTH + alt_km

    x = r * math.cos(lat) * math.cos(lon)
    y = r * math.cos(lat) * math.sin(lon)
    z = r * math.sin(lat)

    return np.array([x, y, z])


def compute_az_el(x, y, z, obs_lat, obs_lon, obs_alt=0.0):
    obs = compute_observer_ecef(obs_lat, obs_lon, obs_alt)

    rho = np.array([x, y, z]) - obs

    lat = math.radians(obs_lat)
    lon = math.radians(obs_lon)

    east = -math.sin(lon) * rho[0] + math.cos(lon) * rho[1]
    north = (
        -math.sin(lat) * math.cos(lon) * rho[0]
        - math.sin(lat) * math.sin(lon) * rho[1]
        + math.cos(lat) * rho[2]
    )
    up = (
        math.cos(lat) * math.cos(lon) * rho[0]
        + math.cos(lat) * math.sin(lon) * rho[1]
        + math.sin(lat) * rho[2]
    )

    az = math.degrees(math.atan2(east, north)) % 360
    el = math.degrees(math.asin(up / np.linalg.norm(rho)))

    return az, el