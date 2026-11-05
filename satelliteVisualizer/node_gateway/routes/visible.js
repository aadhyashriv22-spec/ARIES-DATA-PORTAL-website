const express = require("express");
const axios = require("axios");
const { getCache, setCache } = require("../utils/cache");
const { PYTHON_URL, CACHE_TTL_MS } = require("../config");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lon, alt } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon required" });
    }

    const cacheKey = `visible-${lat}-${lon}-${alt || 0}`;
    const cached = getCache(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const response = await axios.get(`${PYTHON_URL}/visible`, {
      params: { lat, lon, alt }
    });

    setCache(cacheKey, response.data, CACHE_TTL_MS);

    res.json(response.data);
  } catch (err) {
    console.error("Visible route error:", err.message);
    res.status(500).json({ error: "Python service failed" });
  }
});

module.exports = router;