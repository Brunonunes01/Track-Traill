import Constants from "expo-constants";

type Coordinate = { latitude: number; longitude: number };

type DirectionsMode = "walking" | "bicycling" | "driving";

type FetchDirectionsInput = {
  origin: Coordinate;
  destination: Coordinate;
  waypoints?: Coordinate[];
  mode?: DirectionsMode;
};

export type DirectionsResult = {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
};

const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const MAX_WAYPOINTS = 23;

const getDirectionsApiKey = () => {
  const expoConfig = Constants.expoConfig;
  const extraApiKey = expoConfig?.extra?.googleDirectionsApiKey;
  const androidMapsKey = expoConfig?.android?.config?.googleMaps?.apiKey;
  const envApiKey = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY;

  const key = envApiKey || String(extraApiKey || "") || String(androidMapsKey || "");
  if (!key) {
    throw new Error("Google Directions API key não configurada.");
  }

  return key;
};

const encodeCoordinate = (point: Coordinate) => `${point.latitude},${point.longitude}`;

const mapActivityMode = (activityType?: string): DirectionsMode => {
  const normalized = String(activityType || "").toLowerCase();
  if (normalized.includes("cicl")) return "bicycling";
  if (normalized.includes("carro")) return "driving";
  return "walking";
};

const pickWaypoints = (waypoints: Coordinate[]): Coordinate[] => {
  if (waypoints.length <= MAX_WAYPOINTS) return waypoints;

  const step = waypoints.length / MAX_WAYPOINTS;
  const sampled: Coordinate[] = [];
  for (let i = 0; i < MAX_WAYPOINTS; i += 1) {
    const index = Math.floor(i * step);
    sampled.push(waypoints[index]);
  }
  return sampled;
};

const decodePolyline = (encoded: string): Coordinate[] => {
  const points: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

export const travelModeFromActivity = mapActivityMode;

export const fetchGoogleDirections = async ({
  origin,
  destination,
  waypoints = [],
  mode = "walking",
}: FetchDirectionsInput): Promise<DirectionsResult> => {
  const apiKey = getDirectionsApiKey();
  const sampledWaypoints = pickWaypoints(waypoints);

  const params = new URLSearchParams({
    origin: encodeCoordinate(origin),
    destination: encodeCoordinate(destination),
    mode,
    key: apiKey,
  });

  if (sampledWaypoints.length > 0) {
    params.set("waypoints", sampledWaypoints.map(encodeCoordinate).join("|"));
  }

  const response = await fetch(`${GOOGLE_DIRECTIONS_URL}?${params.toString()}`);
  const data = await response.json();

  if (data?.status !== "OK" || !Array.isArray(data?.routes) || data.routes.length === 0) {
    const message = data?.error_message || data?.status || "Falha ao calcular rota real.";
    throw new Error(message);
  }

  const route = data.routes[0];
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const overviewPolyline = route?.overview_polyline?.points;

  if (!overviewPolyline) {
    throw new Error("Rota sem geometria retornada pela API.");
  }

  const distanceMeters = legs.reduce(
    (total: number, leg: any) => total + Number(leg?.distance?.value || 0),
    0
  );
  const durationSeconds = legs.reduce(
    (total: number, leg: any) => total + Number(leg?.duration?.value || 0),
    0
  );

  return {
    coordinates: decodePolyline(overviewPolyline),
    distanceMeters,
    durationSeconds,
    distanceText: `${(distanceMeters / 1000).toFixed(1)} km`,
    durationText: `${Math.max(1, Math.round(durationSeconds / 60))} min`,
  };
};
