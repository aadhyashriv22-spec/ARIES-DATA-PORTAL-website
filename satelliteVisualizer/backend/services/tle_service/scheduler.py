import time
from tle_fetcher import fetch_tle

if __name__ == "__main__":
    while True:
        try:
            fetch_tle()
        except Exception as e:
            print("TLE fetch failed unexpectedly:", e)

        print("Sleeping for 8 hours...")
        time.sleep(8 * 60 * 60)