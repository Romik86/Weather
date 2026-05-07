import CONFIG from './config.js';

const WMO_CODES = {
  0: { description: 'Clear sky', icon: '01d' },
  1: { description: 'Mainly clear', icon: '01d' },
  2: { description: 'Partly cloudy', icon: '02d' },
  3: { description: 'Overcast', icon: '03d' },
  45: { description: 'Foggy', icon: '50d' },
  48: { description: 'Rime fog', icon: '50d' },
  51: { description: 'Light drizzle', icon: '09d' },
  53: { description: 'Moderate drizzle', icon: '09d' },
  55: { description: 'Dense drizzle', icon: '09d' },
  61: { description: 'Slight rain', icon: '10d' },
  63: { description: 'Moderate rain', icon: '10d' },
  65: { description: 'Heavy rain', icon: '10d' },
  71: { description: 'Slight snow', icon: '13d' },
  73: { description: 'Moderate snow', icon: '13d' },
  75: { description: 'Heavy snow', icon: '13d' },
  80: { description: 'Slight rain showers', icon: '09d' },
  81: { description: 'Moderate rain showers', icon: '09d' },
  82: { description: 'Violent rain showers', icon: '09d' },
  95: { description: 'Thunderstorm', icon: '11d' },
  96: { description: 'Thunderstorm with hail', icon: '11d' },
  99: { description: 'Thunderstorm with heavy hail', icon: '11d' }
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { description: 'Unknown', icon: '01d' };
}

async function geocodeCity(city) {
  const url = `${CONFIG.GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error(`City "${city}" not found. Please check the spelling.`);
  }

  return data.results[0];
}

async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl',
    hourly: 'temperature_2m,weather_code,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto'
  });

  const url = `${CONFIG.WEATHER_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return response.json();
}

async function fetchWeatherData(city) {
  const location = await geocodeCity(city);
  const weather = await fetchWeather(location.latitude, location.longitude);

  return {
    location: {
      name: location.name,
      country: location.country,
      countryCode: location.country_code,
      admin: location.admin1 || ''
    },
    weather
  };
}

async function fetchTimelineData(lat, lng, days) {
  const forecastDays = Math.min(days, 7);
  const pastDays = Math.max(0, days - forecastDays);

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: 'auto',
    forecast_days: forecastDays
  });

  if (pastDays > 0) {
    params.set('past_days', pastDays);
  }

  const url = `${CONFIG.WEATHER_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Timeline API error: ${response.status}`);
  }

  return response.json();
}

export { fetchWeatherData, fetchTimelineData, getWeatherInfo };
