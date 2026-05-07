import { fetchWeatherData, fetchTimelineData, getWeatherInfo } from './api.js';
import { debounce, formatTemp, formatDate, saveToStorage, getFromStorage } from './utils.js';
import CONFIG from './config.js';

const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('error-text');
const dashboardEl = document.getElementById('dashboard');
const forecastContainer = document.getElementById('forecast-container');
const weatherChartCanvas = document.getElementById('weather-chart');
const chartLoadingEl = document.getElementById('chart-loading');
const chartNoDataEl = document.getElementById('chart-no-data');
const rangeToggleBtns = document.querySelectorAll('.range-toggle__btn');

let weatherChart = null;
let currentLocation = null;
let currentRange = 7;

function processForecastData(hourly, daily) {
  const hourlyData = hourly.time.map((time, i) => ({
    time,
    temp: hourly.temperature_2m[i],
    weatherCode: hourly.weather_code[i],
    humidity: hourly.relative_humidity_2m[i]
  }));

  const filtered = hourlyData.filter(item => {
    const hour = new Date(item.time).getHours();
    return hour >= 11 && hour <= 14;
  });

  const transformed = filtered.map(item => ({
    date: item.time,
    temp: item.temp,
    weatherCode: item.weatherCode,
    humidity: item.humidity
  }));

  const avgTemp = transformed.reduce((sum, item) => sum + item.temp, 0) / transformed.length;

  const sorted = [...transformed].sort((a, b) => new Date(a.date) - new Date(b.date));

  const dailyForecasts = daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    weatherCode: daily.weather_code[i]
  }));

  const allTemps = dailyForecasts.map(d => d.tempMax);
  const maxTemp = Math.max(...allTemps);
  const minTemps = dailyForecasts.map(d => d.tempMin);
  const minTemp = Math.min(...minTemps);

  return {
    hourly: sorted,
    daily: dailyForecasts,
    avgTemp: Math.round(avgTemp * 10) / 10,
    maxTemp: Math.round(maxTemp),
    minTemp: Math.round(minTemp),
    dataPoints: hourly.time.length
  };
}

function displayCurrentWeather(location, current) {
  const weatherInfo = getWeatherInfo(current.weather_code);
  const locationName = location.admin
    ? `${location.name}, ${location.admin}, ${location.country}`
    : `${location.name}, ${location.country}`;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  document.getElementById('city-name').textContent = locationName;
  document.getElementById('current-time').textContent = `Updated ${timeString}`;
  document.getElementById('temperature').textContent = Math.round(current.temperature_2m);
  document.getElementById('description').textContent = weatherInfo.description;
  document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${weatherInfo.icon}@2x.png`;
  document.getElementById('weather-icon').alt = weatherInfo.description;
  document.getElementById('feels-like').textContent = formatTemp(current.apparent_temperature);
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
  document.getElementById('wind-speed').textContent = `${current.wind_speed_10m} km/h`;
  document.getElementById('pressure').textContent = `${current.pressure_msl} hPa`;
}

function displayForecast(dailyForecasts) {
  forecastContainer.innerHTML = dailyForecasts.map(item => {
    const weatherInfo = getWeatherInfo(item.weatherCode);
    return `
      <div class="forecast-card">
        <img src="https://openweathermap.org/img/wn/${weatherInfo.icon}@2x.png" alt="${weatherInfo.description}" />
        <div class="date">${formatDate(item.date)}</div>
        <div class="temp">${formatTemp(item.tempMax)}</div>
        <div class="desc">${weatherInfo.description}</div>
        <div class="temp-min">Low: ${formatTemp(item.tempMin)}</div>
      </div>
    `;
  }).join('');
}

function displayStatistics(stats) {
  document.getElementById('avg-temp').textContent = `${stats.avgTemp}°C`;
  document.getElementById('max-temp').textContent = formatTemp(stats.maxTemp);
  document.getElementById('min-temp').textContent = formatTemp(stats.minTemp);
  document.getElementById('data-points').textContent = stats.dataPoints;
}

function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  dashboardEl.classList.add('hidden');
}

function hideLoading() {
  loadingEl.classList.add('hidden');
}

function showError(message) {
  errorTextEl.textContent = message;
  errorEl.classList.remove('hidden');
  dashboardEl.classList.add('hidden');
}

function showDashboard() {
  errorEl.classList.add('hidden');
  loadingEl.classList.add('hidden');
  dashboardEl.classList.remove('hidden');
}

async function searchWeather(city) {
  if (!city) {
    showError('Please enter a city name.');
    return;
  }

  if (city.length < 2) {
    showError('City name must be at least 2 characters.');
    return;
  }

  showLoading();

  try {
    const { location, weather } = await fetchWeatherData(city);
    const processed = processForecastData(weather.hourly, weather.daily);

    displayCurrentWeather(location, weather.current);
    displayForecast(processed.daily);
    displayStatistics(processed);

    showDashboard();
    saveToStorage('lastCity', city);

    const geocodeUrl = `${CONFIG.GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();
    if (geoData.results && geoData.results.length > 0) {
      currentLocation = {
        lat: geoData.results[0].latitude,
        lng: geoData.results[0].longitude
      };
      loadChartData(currentRange);
    }
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      showError('Network error. Please check your internet connection.');
    } else {
      showError(error.message);
    }
  } finally {
    hideLoading();
  }
}

searchBtn.addEventListener('click', () => {
  searchWeather(cityInput.value.trim());
});

cityInput.addEventListener('input', debounce(() => {
  const city = cityInput.value.trim();
  if (city.length > 2) {
    searchWeather(city);
  }
}, 800));

cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather(cityInput.value.trim());
  }
});

const lastCity = getFromStorage('lastCity');
if (lastCity) {
  cityInput.value = lastCity;
  searchWeather(lastCity);
}

function showChartLoading() {
  chartLoadingEl.classList.remove('hidden');
  weatherChartCanvas.style.opacity = '0.3';
  chartNoDataEl.classList.add('hidden');
}

function hideChartLoading() {
  chartLoadingEl.classList.add('hidden');
  weatherChartCanvas.style.opacity = '1';
}

function renderChart(data) {
  const labels = data.time.map(d => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const maxTemps = data.temperature_2m_max;
  const minTemps = data.temperature_2m_min;
  const weatherCodes = data.weather_code;

  const bgColors = weatherCodes.map(code => {
    if ([61, 63, 65, 80, 81, 82].includes(code)) return 'rgba(96, 165, 250, 0.5)';
    if ([71, 73, 75, 95, 96, 99].includes(code)) return 'rgba(168, 85, 247, 0.5)';
    if (code === 0 || code === 1) return 'rgba(251, 191, 36, 0.5)';
    return 'rgba(156, 163, 175, 0.4)';
  });

  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#7c5cfc';

  if (weatherChart) {
    weatherChart.destroy();
  }

  const isDark = true;
  const gridColor = 'rgba(255, 255, 255, 0.08)';
  const textColor = 'rgba(255, 255, 255, 0.6)';

  weatherChart = new Chart(weatherChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'High',
          data: maxTemps,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fbbf24',
          pointBorderColor: 'transparent',
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: 'rgba(251, 191, 36, 0.5)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Low',
          data: minTemps,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: 'transparent',
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: 'rgba(96, 165, 250, 0.5)',
          tension: 0.4,
          fill: {
            target: '-1',
            above: 'rgba(124, 92, 252, 0.06)'
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 12, 41, 0.95)',
          titleColor: '#f1f1f1',
          bodyColor: '#a0a0b8',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 14,
          titleFont: { size: 13, weight: '600', family: "'Inter', sans-serif" },
          bodyFont: { size: 12, family: "'Inter', sans-serif" },
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            title: (items) => items[0].label,
            label: (context) => {
              const idx = context.dataIndex;
              const weatherInfo = getWeatherInfo(weatherCodes[idx]);
              return [
                ` ${context.dataset.label}: ${Math.round(context.parsed.y)}°C`,
                ` ${weatherInfo.description}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            drawBorder: false
          },
          ticks: {
            color: textColor,
            font: { size: 11, family: "'Inter', sans-serif" },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          },
          border: {
            display: false
          }
        },
        y: {
          grid: {
            color: gridColor,
            drawBorder: false
          },
          ticks: {
            color: textColor,
            font: { size: 11, family: "'Inter', sans-serif" },
            callback: (value) => `${Math.round(value)}°`
          },
          border: {
            display: false
          }
        }
      }
    },
    plugins: [{
      id: 'bgBars',
      beforeDatasetsDraw(chart) {
        const { ctx, data, scales: { x, y } } = chart;
        const bgColorsArr = bgColors;

        ctx.save();
        data.datasets[0].data.forEach((_, i) => {
          const meta = chart.getDatasetMeta(0);
          const point = meta.data[i];
          if (!point) return;

          const barWidth = x.width / data.labels.length * 0.7;
          const xStart = point.x - barWidth / 2;
          const yTop = y.getPixelForValue(Math.max(...data.datasets[0].data, ...data.datasets[1].data) + 5);
          const yBottom = y.getPixelForValue(Math.min(...data.datasets[0].data, ...data.datasets[1].data) - 5);

          ctx.fillStyle = bgColorsArr[i];
          ctx.beginPath();
          const radius = 4;
          ctx.moveTo(xStart + radius, yTop);
          ctx.lineTo(xStart + barWidth - radius, yTop);
          ctx.quadraticCurveTo(xStart + barWidth, yTop, xStart + barWidth, yTop + radius);
          ctx.lineTo(xStart + barWidth, yBottom);
          ctx.quadraticCurveTo(xStart + barWidth, yBottom, xStart + barWidth - radius, yBottom);
          ctx.lineTo(xStart + radius, yBottom);
          ctx.quadraticCurveTo(xStart, yBottom, xStart, yBottom - radius);
          ctx.lineTo(xStart, yTop + radius);
          ctx.quadraticCurveTo(xStart, yTop, xStart + radius, yTop);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }
    }]
  });
}

async function loadChartData(days) {
  if (!currentLocation) return;

  showChartLoading();

  try {
    const data = await fetchTimelineData(currentLocation.lat, currentLocation.lng, days);

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      chartNoDataEl.textContent = 'No chart data available.';
      chartNoDataEl.classList.remove('hidden');
      return;
    }

    renderChart(data.daily);
    chartNoDataEl.classList.add('hidden');
  } catch (error) {
    chartNoDataEl.textContent = `Unable to load chart data: ${error.message}`;
    chartNoDataEl.classList.remove('hidden');
  } finally {
    hideChartLoading();
  }
}

rangeToggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    rangeToggleBtns.forEach(b => b.classList.remove('range-toggle__btn--active'));
    btn.classList.add('range-toggle__btn--active');
    currentRange = parseInt(btn.dataset.range, 10);
    loadChartData(currentRange);
  });
});

window.updateChartLocation = function(lat, lng) {
  currentLocation = { lat, lng };
  loadChartData(currentRange);
};
