

import math

MU = 398600.4418

def classify_orbit(sat, alt_km):
    mean_motion = sat.no_kozai  # radians per minute
    n = mean_motion / 60.0     # radians per second

    a = (MU / (n**2))**(1/3)
    altitude = a - 6378.137

    if altitude < 2000:
        return "LEO"
    elif altitude < 30000:
        return "MEO"
    elif 35000 <= altitude <= 37000:
        return "GEO"
    else:
        return "HEO"
    

def classify_constellation(name):
    name = name.upper()

    if "STARLINK" in name:
        return "Internet", "USA"
    if "ONEWEB" in name:
        return "Internet", "UK"
    if "IRNSS" in name or "NAVIC" in name:
        return "Navigation", "India"
    if "BEIDOU" in name:
        return "Navigation", "China"
    if "GPS" in name:
        return "Navigation", "USA"

    return "Unknown", "Unknown"