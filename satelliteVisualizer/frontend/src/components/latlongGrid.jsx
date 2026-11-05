import * as Cesium from "cesium";

export function addLatLonGrid(viewer) {
  const entities = [];

  // Longitude lines
  for (let lon = -180; lon <= 180; lon += 10) {
    const positions = [];
    for (let lat = -90; lat <= 90; lat += 1) {
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat));
    }

    const alpha = lon % 30 === 0 ? 0.35 : 0.15;

    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: 1,
        material: new Cesium.Color(1.0, 0.7, 0.3, alpha),
      },
    });

    entities.push(entity);
  }

  // Latitude lines
  for (let lat = -80; lat <= 80; lat += 10) {
    const positions = [];
    for (let lon = -180; lon <= 180; lon += 1) {
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat));
    }

    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: 1,
        material: new Cesium.Color(1.0, 1.0, 1.0, 0.2),
      },
    });

    entities.push(entity);
  }

  return entities;
}