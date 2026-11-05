from sgp4.api import Satrec
from sgp4.api import jday
from datetime import datetime
import requests
import numpy as np
from math import sin, cos, sqrt, atan2, asin, radians, degrees

TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
R_EARTH = 6378.137


def fetch_tle():
    response = requests.get(TLE_URL, timeout=20)
    return response.text


def gmst(dt):
    jd = (
        367 * dt.year
        - int((7 * (dt.year + int((dt.month + 9) / 12))) / 4)
        + int((275 * dt.month) / 9)
        + dt.day
        + 1721013.5
        + (dt.hour + dt.minute / 60 + dt.second / 3600) / 24
    )

    T = (jd - 2451545.0) / 36525.0

    gmst = (
        280.46061837
        + 360.98564736629 * (jd - 2451545)
        + 0.000387933 * T**2
        - (T**3) / 38710000.0
    )

    return radians(gmst % 360)


def eci_to_ecef(r_eci, dt):
    theta = gmst(dt)

    x = r_eci[0] * cos(theta) + r_eci[1] * sin(theta)
    y = -r_eci[0] * sin(theta) + r_eci[1] * cos(theta)
    z = r_eci[2]

    return np.array([x, y, z])


def compute_az_el(r_ecef, observer_lat, observer_lon, observer_alt=0):
    lat = radians(observer_lat)
    lon = radians(observer_lon)

    x_obs = (R_EARTH + observer_alt) * cos(lat) * cos(lon)
    y_obs = (R_EARTH + observer_alt) * cos(lat) * sin(lon)
    z_obs = (R_EARTH + observer_alt) * sin(lat)

    obs = np.array([x_obs, y_obs, z_obs])
    rho = r_ecef - obs

    east = -sin(lon) * rho[0] + cos(lon) * rho[1]
    north = (
        -sin(lat) * cos(lon) * rho[0]
        - sin(lat) * sin(lon) * rho[1]
        + cos(lat) * rho[2]
    )
    up = (
        cos(lat) * cos(lon) * rho[0]
        + cos(lat) * sin(lon) * rho[1]
        + sin(lat) * rho[2]
    )

    az = atan2(east, north)
    el = asin(up / sqrt(east**2 + north**2 + up**2))

    return degrees(az) % 360, degrees(el)


def test_propagation():
    tle_text = fetch_tle()
    lines = tle_text.splitlines()

    print("Testing first 5 satellites...\n")

    for i in range(0, 15, 3):
        name = lines[i]
        line1 = lines[i + 1]
        line2 = lines[i + 2]

        sat = Satrec.twoline2rv(line1, line2)

        now = datetime.utcnow()
        jd, fr = jday(
            now.year, now.month, now.day,
            now.hour, now.minute, now.second
        )

        error, r, v = sat.sgp4(jd, fr)

        if error == 0:
            r_ecef = eci_to_ecef(r, now)
            az, el = compute_az_el(r_ecef, 28.6, 77.2)

            print(name)
            print("Elevation:", round(el, 2))
            print("Azimuth:", round(az, 2))
            print("-" * 40)


if __name__ == "__main__":
    test_propagation()