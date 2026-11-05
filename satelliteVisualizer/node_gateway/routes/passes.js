const express = require("express");
const axios = require("axios");
const { PYTHON_URL } = require("../config");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lon, hours, alt } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon required" });
    }

    const response = await axios.get(`${PYTHON_URL}/passes`, {
      params: { lat, lon, hours, alt }
    });

    res.json(response.data);
  } catch (err) {
    console.error("Passes route error:", err.message);
    res.status(500).json({ error: "Python service failed" });
  }
});

module.exports = router;