const OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_TIMEOUT_MS = 10000;

const parseWeatherData = (data) => {
  const current = data?.current || {};
  const hourly = data?.hourly || {};
  const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
  const rainProbabilities = Array.isArray(hourly.precipitation_probability)
    ? hourly.precipitation_probability
    : [];

  // Usamos o timestamp atual para pegar a chance de chuva da hora equivalente.
  const currentTime = current.time;
  const currentIndex = hourlyTimes.findIndex((time) => time === currentTime);
  const matchedRainChance = currentIndex >= 0 ? rainProbabilities[currentIndex] : null;

  return {
    temperature: Math.round(current.temperature_2m ?? 0),
    rainChance: Math.round(matchedRainChance ?? rainProbabilities[0] ?? 0),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    weatherCode: current.weather_code ?? 0,
  };
};

export const getWeatherByCoordinates = async (latitude, longitude) => {
  if (latitude == null || longitude == null) {
    throw new Error("Latitude e longitude são obrigatórias para buscar o clima.");
  }

  const query =
    `latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,wind_speed_10m,weather_code" +
    "&hourly=precipitation_probability" +
    "&wind_speed_unit=kmh&timezone=auto";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${OPEN_METEO_BASE_URL}?${query}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tempo de espera excedido ao consultar o clima.");
    }
    throw new Error("Falha de rede ao consultar o clima.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error("Falha ao consultar a API de clima.");
  }

  const data = await response.json();
  return parseWeatherData(data);
};
