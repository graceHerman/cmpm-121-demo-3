// todo

import leaflet from "leaflet"; // @deno-types="npm:@types/leaflet@^1.9.14"

// Import styles
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts"; // Fix for missing marker images
import luck from "./luck.ts"; // Deterministic random number generator

// Game configuration and constants
const config = {
  initialZoom: 19,
  tileSize: 1e-4,
  neighborhoodRange: 8,
  cacheProbability: 0.1,
  startLocation: leaflet.latLng(36.98949379578401, -122.06277128548504),
  origin: { lat: 0, lng: 0 }, // Null Island anchor point
};

// Cache for grid cells for Flyweight pattern
const gridCellCache = new Map<string, GridCell>();

// Define interfaces
interface GridCell {
  i: number;
  j: number;
}

interface Coin {
  i: number;
  j: number;
  serial: number;
}

// Initialize the map
const map = initializeMap();

// Player marker and coins collected by player
const player = {
  marker: leaflet.marker(config.startLocation),
  coinsCollected: 0,
};

// Set up player marker and display
initializePlayerMarker(player);
updateCoinsDisplay(player.coinsCollected);

// Generate caches around the player's location
generateCachesAroundPlayer();

/*// Create a sample button to demonstrate functionality in `main.ts`
const demoButton = document.createElement("button");
demoButton.innerHTML = "Click here";
demoButton.addEventListener("click", () => alert("You clicked the button!"));
document.body.appendChild(demoButton);*/

// Function to convert latitude-longitude to grid cell coordinates
function latLngToGridCoords(lat: number, lng: number): GridCell {
  const i = Math.floor((lat - config.origin.lat) / config.tileSize); // latitude = i
  const j = Math.floor((lng - config.origin.lng) / config.tileSize); // longitude = j

  const key = `${i},${j}`;

  // Make Flyweight Pattern
  // Check if the grid cell already exists in the cache
  // If it doesn't exist, create a new grid cell and cache it
  if (!gridCellCache.has(key)) {
    gridCellCache.set(key, { i, j });
  }

  return gridCellCache.get(key)!; // Return the shared/newly created grid cell
}

// Initializes the map view and settings
function initializeMap() {
  const mapInstance = leaflet.map(document.getElementById("map")!, {
    center: config.startLocation,
    zoom: config.initialZoom,
    minZoom: config.initialZoom,
    maxZoom: config.initialZoom,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  // Add tile layer to the map
  leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapInstance);

  return mapInstance;
}

// Adds the player marker to the map and binds a tooltip
function initializePlayerMarker(
  player: { marker: leaflet.Marker; coinsCollected: number },
) {
  player.marker.bindTooltip("Player Location");
  player.marker.addTo(map);
}

// Updates the display for the player's coin count
function updateCoinsDisplay(coins: number) {
  const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
  statusPanel.innerHTML = `${coins} coins collected`;
}

// Updates the displayed cache value after a coin is collected or deposited
function updateCacheValueDisplay(
  popupContent: HTMLElement,
  newCacheValue: number,
) {
  const cacheValueSpan = popupContent.querySelector<HTMLSpanElement>("#value");
  if (cacheValueSpan) {
    cacheValueSpan.textContent = newCacheValue.toString();
  }
}

// Function to generate caches around the player's location based on the probability configuration
// try to use cell's i and j later
function generateCachesAroundPlayer() {
  for (let i = -config.neighborhoodRange; i <= config.neighborhoodRange; i++) {
    for (
      let j = -config.neighborhoodRange;
      j <= config.neighborhoodRange;
      j++
    ) {
      if (luck([i, j].toString()) < config.cacheProbability) {
        spawnCache(i, j);
      }
    }
  }
}

// Create a cache at a specific location and binds interactive popups
function spawnCache(row: number, col: number) {
  const origin = config.startLocation;

  // Use latLngToGridCoords to get the correct grid cell
  const gridCell = latLngToGridCoords(
    origin.lat + row * config.tileSize,
    origin.lng + col * config.tileSize,
  );

  // Have grid coordinates from latLngToGridCoords
  const { i, j } = gridCell;

  const cacheBounds = leaflet.latLngBounds(
    [origin.lat + row * config.tileSize, origin.lng + col * config.tileSize],
    [
      origin.lat + (row + 1) * config.tileSize,
      origin.lng + (col + 1) * config.tileSize,
    ],
  );

  const cacheRect = leaflet.rectangle(cacheBounds);
  cacheRect.addTo(map);

  // Initialize cache coins with unique identities (Flyweight pattern)
  let cacheValue = Math.floor(luck([i, j, "value"].toString()) * 100);
  const coins = Array.from({ length: cacheValue }, (_, serial) => ({
    i,
    j,
    serial,
  }));

  // Bind a popup to the cache with collect and deposit functionality
  cacheRect.bindPopup(() => {
    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <div>Cache at (${i},${j}): <span id="value">${cacheValue}</span> coins.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;

    // Handle collect button click to gather coins from the cache
    const collectButton = popupContent.querySelector<HTMLButtonElement>(
      "#collect",
    )!;
    collectButton.addEventListener("click", () => {
      if (cacheValue > 0) {
        cacheValue--;
        const collectedCoin = coins.pop();
        player.coinsCollected++;
        updateCoinsDisplay(player.coinsCollected);
        updateCacheValueDisplay(popupContent, cacheValue);

        console.log(`Collected coin:`, collectedCoin);
      }
    });

    // Handle deposit button click to deposit coins into the cache
    const depositButton = popupContent.querySelector<HTMLButtonElement>(
      "#deposit",
    )!;
    depositButton.addEventListener("click", () => {
      if (player.coinsCollected > 0) {
        const depositCoin = { i, j, serial: cacheValue };
        coins.push(depositCoin);
        cacheValue++;
        player.coinsCollected--;
        updateCoinsDisplay(player.coinsCollected);
        updateCacheValueDisplay(popupContent, cacheValue);

        console.log(`Deposited coin:`, depositCoin);
      }
    });

    return popupContent;
  });
}
