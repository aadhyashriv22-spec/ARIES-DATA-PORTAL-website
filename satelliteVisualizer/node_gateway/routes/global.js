const express = require("express");
const axios = require("axios");
const { PYTHON_URL } = require("../config");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_URL}/global`);
    res.json(response.data);
  } catch (err) {
    console.error("Global route error:", err.message);
    res.status(500).json({ error: "Python service failed" });
  }
});

module.exports = router;