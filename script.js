
const API_KEY = "1839526340af077abe05753dd66e4a45";

const CURRENT_URL =
    "https://api.openweathermap.org/data/2.5/weather";

const FORECAST_URL =
    "https://api.openweathermap.org/data/2.5/forecast";

const GEO_URL =
    "https://api.openweathermap.org/geo/1.0/direct";

const ONE_CALL_URL =
    "https://api.openweathermap.org/data/3.0/onecall";

const $ = (id) => document.getElementById(id);

const form = $("weather-form");
const cityInput = $("city-input");
const searchButton = $("search-button");
const statusMessage = $("status-message");

let currentWeather = null;
let shortForecast = null;
let extendedForecast = null;
let selectedUnit = "metric";
let activeCity = "";
let activeCoordinates = null;
let favoriteCity = localStorage.getItem("weatherFavorite") || "";



async function getJSON(url) {
    const response = await fetch(url);

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an unreadable response.");
    }

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error(
                "API key rejected. Check the key, activation, and API access."
            );
        }

        if (response.status === 404) {
            throw new Error("City not found. Check the spelling.");
        }

        if (response.status === 429) {
            throw new Error("API request limit reached. Try again later.");
        }

        throw new Error(
            data.message || `Weather request failed (${response.status}).`
        );
    }

    return data;
}

function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
}


function iconURL(iconCode) {
    if (!iconCode) {
        return "https://openweathermap.org/img/wn/01d@2x.png";
    }

    return `https://openweathermap.org/img/wn/${iconCode}.png`;
}

function displayTemperature(celsius) {
    if (celsius == null || !Number.isFinite(Number(celsius))) {
        return "--°";
    }

    const value = selectedUnit === "imperial"
        ? Number(celsius) * 9 / 5 + 32
        : Number(celsius);

    return `${Math.round(value)}°${selectedUnit === "metric" ? "C" : "F"}`;
}

function displayWind(metresPerSecond) {
    if (metresPerSecond == null) return "--";

    if (selectedUnit === "imperial") {
        return `${(metresPerSecond * 2.23694).toFixed(1)} mph`;
    }

    return `${(metresPerSecond * 3.6).toFixed(1)} km/h`;
}

function formatClock(timestamp, timezoneOffset = 0) {
    
    const localDate = new Date((timestamp + timezoneOffset) * 1000);

    return localDate.toLocaleTimeString("en-GB", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDay(timestamp, timezoneOffset = 0) {
    const localDate = new Date((timestamp + timezoneOffset) * 1000);

    return localDate.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short"
    });
}

function localDateKey(timestamp, timezoneOffset = 0) {
    const date = new Date((timestamp + timezoneOffset) * 1000);

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
}

function localTimeLabel(timestamp, timezoneOffset = 0) {
    return formatClock(timestamp, timezoneOffset);
}


form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
        setStatus("Please enter a city name.", true);
        return;
    }

    if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
        setStatus("Add your OpenWeather API key in script.js.", true);
        return;
    }

    await loadWeather(city);
});

async function loadWeather(city) {
    searchButton.disabled = true;
    setStatus(`Fetching live weather for ${city}...`);

    try {
      
        const query = `q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

        const [current, forecast] = await Promise.all([
            getJSON(`${CURRENT_URL}?${query}`),
            getJSON(`${FORECAST_URL}?${query}`)
        ]);

        currentWeather = current;
        shortForecast = forecast;
        activeCity = current.name;

        activeCoordinates = {
            lat: current.coord.lat,
            lon: current.coord.lon
        };

        extendedForecast = null;

        renderCurrentWeather();
        renderHourlyForecast();

        
        await loadExtendedForecast();

       
        renderDailyForecast();

        const forecastMessage = extendedForecast
            ? "Live weather and extended forecast loaded."
            : "Current weather and available 5-day forecast loaded. Seven-day data requires One Call API 3.0 access.";

        setStatus(`${forecastMessage} Last updated ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })}.`);

        updateFavoriteButton();
    } catch (error) {
        setStatus(error.message || "Unable to load weather.", true);
    } finally {
        searchButton.disabled = false;
    }
}



function renderCurrentWeather() {
    const data = currentWeather;
    const timezone = data.timezone || 0;

    $("city-name").textContent = data.name;
    $("location-label").textContent =
        [data.sys?.state, data.sys?.country].filter(Boolean).join(", ") ||
        data.sys?.country ||
        "Current location";

    $("current-date").textContent =
        new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    $("temperature").textContent = displayTemperature(data.main.temp);
    $("description").textContent = data.weather?.[0]?.description || "Conditions unavailable";

    $("feels-like").textContent =
        `Feels like ${displayTemperature(data.main.feels_like)}`;

    $("current-icon").src = iconURL(data.weather[0].icon);
    $("current-icon").alt = data.weather[0].description || "Current weather";

    $("humidity").textContent = `${data.main.humidity}%`;
    $("wind").textContent = displayWind(data.wind?.speed);
    $("wind-unit").textContent =
        selectedUnit === "metric" ? "Kilometres per hour" : "Miles per hour";

    $("pressure").textContent =
        data.main.pressure != null ? `${data.main.pressure} hPa` : "--";

    $("visibility").textContent =
        data.visibility != null
            ? `${(data.visibility / 1000).toFixed(1)} km`
            : "--";

    $("sunrise").textContent = data.sys?.sunrise
        ? `Sunrise ${formatClock(data.sys.sunrise, timezone)}`
        : "Sunrise unavailable";

    $("sunset").textContent = data.sys?.sunset
        ? `Sunset ${formatClock(data.sys.sunset, timezone)}`
        : "Sunset unavailable";
}



function renderHourlyForecast() {
    const container = $("hourly-forecast");

    if (!shortForecast?.list?.length) {
        container.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Hourly forecast is unavailable.";
        container.append(empty);
        return;
    }

    const timezone = shortForecast.city?.timezone || 0;

    
    const items = shortForecast.list.slice(0, 8);

    container.replaceChildren();

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "hour-card";

        const time = document.createElement("p");
        time.className = "hour-time";
        time.textContent = localTimeLabel(item.dt, timezone);

        const icon = document.createElement("img");
        icon.className = "forecast-icon";
        icon.src = iconURL(item.weather[0].icon);
        console.log("Weather:", item.weather[0].description);
        console.log("Icon code:", item.weather[0].icon);
        console.log("Icon URL:", icon.src);  
        icon.alt = item.weather[0].description || "Weather";

        const temp = document.createElement("p");
        temp.className = "hour-temp";
        temp.textContent = displayTemperature(item.main.temp);

        const rain = document.createElement("p");
        rain.className = "hour-pop";
        rain.textContent = `💧 ${Math.round((item.pop || 0) * 100)}%`;

        card.append(time, icon, temp, rain);
        container.append(card);
    });
}



async function loadExtendedForecast() {
    const { lat, lon } = activeCoordinates;

    try {
       
        const url =
            `${ONE_CALL_URL}?lat=${lat}&lon=${lon}` +
            `&appid=${API_KEY}&units=metric`;

        extendedForecast = await getJSON(url);

        if (!Array.isArray(extendedForecast.daily) ||
            extendedForecast.daily.length === 0) {
            extendedForecast = null;
        }
    } catch (error) {
        
        console.info("Extended forecast unavailable:", error.message);
        extendedForecast = null;
    }
}



function renderDailyForecast() {
    const container = $("daily-forecast");
    container.replaceChildren();

    if (extendedForecast?.daily?.length) {
        $("forecast-source").textContent = "One Call live daily forecast";

        const timezone = extendedForecast.timezone_offset || 0;

        extendedForecast.daily.slice(0, 7).forEach((day) => {
            const weather = day.weather?.[0];

            if (!weather || day.temp?.min == null || day.temp?.max == null) {
                return;
            }

            const card = createDayCard({
                timestamp: day.dt,
                timezone,
                icon: weather.icon,
                description: weather.description,
                high: day.temp.max,
                low: day.temp.min
            });

            container.append(card);
        });

        if (container.children.length) return;
    }

  
    $("forecast-source").textContent = "Standard forecast: up to 5 days";

    if (!shortForecast?.list?.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Daily forecast is unavailable.";
        container.append(empty);
        return;
    }

    const timezone = shortForecast.city?.timezone || 0;
    const groups = new Map();

    shortForecast.list.forEach((item) => {
        const key = localDateKey(item.dt, timezone);

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(item);
    });

    Array.from(groups.values()).slice(0, 5).forEach((items) => {
        const temps = items.map(item => item.main.temp);
        const middle = items[Math.floor(items.length / 2)];
        const card = createDayCard({
            timestamp: middle.dt,
            timezone,
            icon: middle.weather[0].icon,
            description: middle.weather[0].description,
            high: Math.max(...temps),
            low: Math.min(...temps)
        });

        container.append(card);
    });

    const note = document.createElement("p");
    note.className = "forecast-note";
    note.textContent =
        "Showing only dates returned by the standard forecast API. Enable One Call API 3.0 for a true 7-day outlook.";
    container.append(note);
}

function createDayCard({ timestamp, timezone, icon, description, high, low }) {
    const card = document.createElement("article");
    card.className = "day-card";

    const day = document.createElement("p");
    day.className = "day-name";
    day.textContent = formatDay(timestamp, timezone);

    const image = document.createElement("img");
    image.className = "day-icon";
    image.src = iconURL(icon);
    image.alt = description || "Forecast";

    const temps = document.createElement("p");
    temps.className = "day-temps";

    const highSpan = document.createElement("span");
    highSpan.textContent = displayTemperature(high);

    const lowSpan = document.createElement("span");
    lowSpan.textContent = displayTemperature(low);

    temps.append(highSpan, document.createTextNode(" / "), lowSpan);

    const desc = document.createElement("p");
    desc.className = "day-description";
    desc.textContent = description || "Conditions unavailable";

    card.append(day, image, temps, desc);
    return card;
}



document.querySelectorAll("[data-unit]").forEach((button) => {
    button.addEventListener("click", () => {
        selectedUnit = button.dataset.unit;

        document.querySelectorAll("[data-unit]").forEach((item) => {
            const active = item.dataset.unit === selectedUnit;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        if (currentWeather) renderCurrentWeather();
        if (shortForecast) renderHourlyForecast();
        if (shortForecast) renderDailyForecast();
    });
});



function updateFavoriteButton() {
    const saved = activeCity.toLowerCase() === favoriteCity.toLowerCase();

    $("favorite-button").classList.toggle("saved", saved);
    $("favorite-button").textContent = saved ? "★" : "☆";
    $("favorite-button").setAttribute(
        "aria-label",
        saved ? "Remove city from favorites" : "Add city to favorites"
    );
}

$("favorite-button").addEventListener("click", () => {
    if (!activeCity) {
        setStatus("Search for a city before saving a favorite.", true);
        return;
    }

    if (activeCity.toLowerCase() === favoriteCity.toLowerCase()) {
        favoriteCity = "";
        localStorage.removeItem("weatherFavorite");
        setStatus("Favorite removed.");
    } else {
        favoriteCity = activeCity;
        localStorage.setItem("weatherFavorite", favoriteCity);
        setStatus(`${favoriteCity} saved as your favorite.`);
    }

    updateFavoriteButton();
});



document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        if (button.dataset.view === "search") {
            cityInput.focus();
            setStatus("Enter a city to search for its weather.");
        } else if (button.dataset.view === "favorites") {
            if (favoriteCity) {
                cityInput.value = favoriteCity;
                loadWeather(favoriteCity);
            } else {
                setStatus("No favorite saved yet. Search for a city and tap ☆.");
            }
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
});



document.querySelectorAll("[data-unit]").forEach((button) => {
    button.setAttribute(
        "aria-pressed",
        String(button.dataset.unit === selectedUnit)
    );
});

if (favoriteCity) {
    cityInput.value = favoriteCity;
    loadWeather(favoriteCity);
}