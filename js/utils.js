/**
 * Debounce function - limits how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Format temperature with unit
 * @param {number} temp - Temperature value
 * @param {string} unit - Temperature unit (default: °C)
 * @returns {string}
 */
export function formatTemp(temp, unit = '°C') {
  return `${Math.round(temp)}${unit}`;
}

/**
 * Format date string for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format time from date string
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Retrieve data from localStorage
 * @param {string} key - Storage key
 * @returns {*}
 */
export function getFromStorage(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
