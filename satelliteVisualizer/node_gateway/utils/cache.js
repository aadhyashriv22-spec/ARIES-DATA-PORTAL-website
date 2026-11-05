const cacheStore = {};

function getCache(key) {
  const item = cacheStore[key];
  if (!item) return null;

  if (Date.now() > item.expiry) {
    delete cacheStore[key];
    return null;
  }

  return item.data;
}

function setCache(key, data, ttl) {
  cacheStore[key] = {
    data,
    expiry: Date.now() + ttl
  };
}

module.exports = { getCache, setCache };