// todo

import leaflet from "leaflet"; // @deno-types="npm:@types/leaflet@^1.9.14"

// Import styles
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts"; // Deterministic random number generator

// Game configuration and constants
// neighborhoodRange = Number of tiles to generate
// cacheProbability = probability of a cache spawning ina  tile
// startingLocation = location of Oake's College
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

// Set of all active caches on the map
const activeCaches = new Set<leaflet.Rectangle>();

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

// gridCellKey = Unique identifier for the cache (e.g., coordinates)
// cacheValue = Number of coins in the cache
interface CacheMemento {
  gridCellKey: string;
  cacheValue: number;
}

// Manager for handling cache mementos (mementos will be stored here)
const cacheMementoManager: Map<string, CacheMemento> = new Map();

// To save the state of a cache
function saveCacheState(i: number, j: number, cacheValue: number): void {
  const gridCellKey = `${i},${j}`;
  cacheMementoManager.set(gridCellKey, {
    gridCellKey,
    cacheValue,
  });
}

// To restore the state of a cache
function restoreCacheState(i: number, j: number): number {
  const gridCellKey = `${i},${j}`;
  const memento = cacheMementoManager.get(gridCellKey);

  // Default to 0 if no state is saved
  return memento ? memento.cacheValue : 0;
}

// Initialize the map
const map = initializeMap();

// Player marker and coins collected by player
const player = {
  marker: leaflet.marker(config.startLocation),
  coinsCollected: 0,
};

// Set up player marker and display
// And generate initial caches around the player's starting location
initializePlayerMarker(player);
updateCoinsDisplay(player.coinsCollected);
generateCachesAroundPlayer();
//loadGameState();

// Function to convert latitude-longitude to grid cell coordinates
function latLngToGridCoords(lat: number, lng: number): GridCell {
  const i = Math.floor((lat - config.origin.lat) / config.tileSize);
  const j = Math.floor((lng - config.origin.lng) / config.tileSize);
  const key = `${i},${j}`;

  // Use Flyweight Pattern, check if the cell exists
  // if not, cache it
  if (!gridCellCache.has(key)) {
    gridCellCache.set(key, { i, j });
  }

  // Return the cached/newly created cell
  return gridCellCache.get(key)!;
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
  player.marker.bindTooltip("Player's here :D");
  player.marker.addTo(map);
}

// Updates the display for player's coin count
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

// Function to generate caches around the player's location based on proximity
function generateCachesAroundPlayer() {
  const { lat: playerLat, lng: playerLng } = player.marker.getLatLng();

  // Remove all previous caches from the map
  activeCaches.forEach((cache) => cache.remove());
  activeCaches.clear();

  // Generate new caches around the player based on neighborhood range
  for (let i = -config.neighborhoodRange; i <= config.neighborhoodRange; i++) {
    for (
      let j = -config.neighborhoodRange;
      j <= config.neighborhoodRange;
      j++
    ) {
      const lat = playerLat + i * config.tileSize;
      const lng = playerLng + j * config.tileSize;

      // Determine if a cache should spawn at this location
      // Restore cache state if it's within range
      if (luck([lat, lng].toString()) < config.cacheProbability) {
        spawnCache(lat, lng);
      }
    }
  }
}

// Create a cache at a specific location and bind interactive popups
function spawnCache(lat: number, lng: number) {
  const gridCell = latLngToGridCoords(lat, lng);
  const { i, j } = gridCell;

  const cacheBounds = leaflet.latLngBounds(
    [lat, lng],
    [lat + config.tileSize, lng + config.tileSize],
  );

  const cacheRect = leaflet.rectangle(cacheBounds);
  cacheRect.addTo(map);
  activeCaches.add(cacheRect);

  // Retrieve the cache value from the saved state, if available
  let cacheValue = restoreCacheState(i, j);

  // If no value exists in the memento, generate a new one
  if (cacheValue === 0) {
    cacheValue = Math.floor(luck([i, j, "value"].toString()) * 100);
    console.log(`Generated new cache at (${i}, ${j}) with value ${cacheValue}`);
  } else {
    console.log(`Restored cache at (${i}, ${j}) with value ${cacheValue}`);
  }

  // Initialize cache coins with unique identities (Flyweight pattern)
  const coins = Array.from({ length: cacheValue }, (_, serial) => ({
    i,
    j,
    serial,
  }));

  // Save the state after initializing the cache
  saveCacheState(i, j, cacheValue);

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
        // Save updated cache state
        saveCacheState(i, j, cacheValue);
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
        // Save updated cache state
        saveCacheState(i, j, cacheValue);
      }
    });

    return popupContent;
  });
}

// Function to save the game state into a local storage
function saveGameState() {
  const gameState = {
    position: player.marker.getLatLng(),
    coinsCollected: player.coinsCollected,
    cacheStates: Array.from(cacheMementoManager.entries()),
  };
  localStorage.setItem("gameState", JSON.stringify(gameState));
  console.log("Game state saved:", gameState); // Log for debugging
}

// Function to update the player's location
function updatePlayerLocation(lat: number, lng: number) {
  player.marker.setLatLng(leaflet.latLng(lat, lng));
  map.setView(leaflet.latLng(lat, lng), config.initialZoom);
  generateCachesAroundPlayer(); // Regenerate caches around the new location

  const newLocation = leaflet.latLng(lat, lng);
  player.marker.setLatLng(newLocation);
  map.setView(newLocation, config.initialZoom);

  // Update movement history, polyline path and refresh caches based on new position
  movementHistory.push(newLocation);
  movementPolyline.setLatLngs(movementHistory);
  generateCachesAroundPlayer();

  saveGameState(); // Save the updated game state
}

// polyline to render player's movement history
const movementHistory: leaflet.LatLng[] = [];
const movementPolyline = leaflet.polyline(movementHistory, { color: "blue" })
  .addTo(map);

/*// Function that loads game state from previous session if the player closed the game's browser window
function loadGameState() {
  const savedState = localStorage.getItem('gameState');
  if (savedState) {
    try {
      const gameState = JSON.parse(savedState);
      // Apply saved state to game elements
      player.marker.setLatLng(gameState.position);
      player.coinsCollected = gameState.coinsCollected;
      console.log('Game state loaded:', gameState);
    } catch (error) {
      console.error('Error loading game state:', error);
    }
  }
}*/

// Event listeners for movement buttons
// Move North button
document.getElementById("north")?.addEventListener("click", () => {
  const currentLatLng = player.marker.getLatLng();
  const newLat = currentLatLng.lat + config.tileSize;
  updatePlayerLocation(newLat, currentLatLng.lng);
});

// Move South button
document.getElementById("south")?.addEventListener("click", () => {
  const currentLatLng = player.marker.getLatLng();
  const newLat = currentLatLng.lat - config.tileSize;
  updatePlayerLocation(newLat, currentLatLng.lng);
});

// Move West button
document.getElementById("west")?.addEventListener("click", () => {
  const currentLatLng = player.marker.getLatLng();
  const newLng = currentLatLng.lng - config.tileSize;
  updatePlayerLocation(currentLatLng.lat, newLng);
});

// Move east button
document.getElementById("east")?.addEventListener("click", () => {
  const currentLatLng = player.marker.getLatLng();
  const newLng = currentLatLng.lng + config.tileSize;
  updatePlayerLocation(currentLatLng.lat, newLng);
});

// Button for automatic position updating
document.getElementById("automatice")?.addEventListener("click", () => {
  // ...
});

// Button for reseting the game's state, returning all coins to home caches
// and erasing location history
document.getElementById("reset")?.addEventListener("click", () => {
  // Clear the game state
  localStorage.clear();
  player.coinsCollected = 0;
  updateCoinsDisplay(player.coinsCollected);
  movementHistory.length = 0;
  movementPolyline.setLatLngs(movementHistory);
  cacheMementoManager.clear();

  // Reset player position to starting location
  updatePlayerLocation(config.startLocation.lat, config.startLocation.lng);

  console.log("Game state reset.");
});
