// todo

import leaflet from "leaflet"; // @deno-types="npm:@types/leaflet@^1.9.14"

// Import styles
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts"; // Deterministic random number generator

import "./board.ts";

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
  inventory: [] as { serial: number; location: string }[], // Inventory
};

// Set up player marker and display
// And generate initial caches around the player's starting location
initializePlayerMarker(player);
updateCoinsDisplay(player.coinsCollected);
generateCachesAroundPlayer();

document.addEventListener("DOMContentLoaded", () => {
  loadGameState();
});

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

/*// Updates the displayed cache value after a coin is collected or deposited
function updateCacheValueDisplay(
  popupContent: HTMLElement,
  newCacheValue: number,
) {
  const cacheValueSpan = popupContent.querySelector<HTMLSpanElement>("#value");
  if (cacheValueSpan) {
    cacheValueSpan.textContent = newCacheValue.toString();
  }
}*/

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

    // Helper to render the coin list with a cutoff at 20 coins
    const renderCoinList = () => {
      const displayedCoins = coins.slice(1, 21); // Show only the first 20 coins
      const additionalCoins = coins.length - displayedCoins.length;

      let coinListHtml = displayedCoins
        .map((coin) =>
          `<div id="coin-${coin.serial}">Coin ${coin.serial} at (${coin.i}, ${coin.j})</div>`
        )
        .join("");

      // Add a message if there are additional coins
      if (additionalCoins > 0) {
        coinListHtml += `<div>...and ${additionalCoins} more coins.</div>`;
      }

      return coinListHtml;
    };

    // Initial popup content with the coin list
    popupContent.innerHTML = `
      <div>
        Cache at (${i}, ${j}): <span id="value">${cacheValue}</span> coins.
      </div>
      <div id="coin-list">
        ${renderCoinList()}
      </div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;

    // References to the dynamic elements
    const valueElement = popupContent.querySelector<HTMLSpanElement>("#value");
    const coinListElement = popupContent.querySelector<HTMLDivElement>(
      "#coin-list",
    );

    // Function to update the coin list display
    const updateCoinListDisplay = () => {
      if (coinListElement) {
        coinListElement.innerHTML = renderCoinList();
      }
    };

    // Function to update cache value display
    const updateCacheValueDisplay = (value: number) => {
      if (valueElement) valueElement.textContent = value.toString();
    };

    // Handle collect button click to gather coins from the cache
    const collectButton = popupContent.querySelector<HTMLButtonElement>(
      "#collect",
    )!;
    collectButton.addEventListener("click", () => {
      if (cacheValue > 0) {
        cacheValue--;
        const collectedCoin = coins.shift(); // Remove the first coin (top coin)
        if (collectedCoin) {
          player.coinsCollected++;
          // Add coin to inventory with cache location
          player.inventory.push({
            serial: collectedCoin.serial,
            location: `(${collectedCoin.i}, ${collectedCoin.j})`,
          });

          updateCoinsDisplay(player.coinsCollected);
          updateCacheValueDisplay(cacheValue);

          // Update the coin list display in the UI
          updateCoinListDisplay();
          // Update inventory display
          updateInventoryDisplay();

          console.log(`Collected coin:`, collectedCoin);
          saveCacheState(i, j, cacheValue);
        }
      }
    });

    // Handle deposit button click to deposit coins into the cache
    const depositButton = popupContent.querySelector<HTMLButtonElement>(
      "#deposit",
    )!;
    depositButton.addEventListener("click", () => {
      if (player.coinsCollected > 0) {
        const depositCoin = { i, j, serial: cacheValue };
        coins.push(depositCoin); // Add coin to the end of the array
        cacheValue++;
        player.coinsCollected--;
        updateCoinsDisplay(player.coinsCollected);
        updateCacheValueDisplay(cacheValue);

        // Update coin list in the UI
        updateCoinListDisplay();

        console.log(`Deposited coin:`, depositCoin);
        // Save updated cache state
        saveCacheState(i, j, cacheValue);
      }
    });

    return popupContent;
  });
}

// Function to update the inventory display
function updateInventoryDisplay() {
  const inventoryPanel = document.querySelector<HTMLDivElement>(
    "#inventoryPanel",
  )!;

  // Display the inventory list
  inventoryPanel.innerHTML = `<h3>Inventory</h3>` + player.inventory.map(
    (item) => `<div>${item.location} #${item.serial}</div>`,
  ).join("");
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

// Function that loads game state from previous session if the player closed the game's browser window
function loadGameState() {
  console.log("Trying to load game state...");
  const savedData = localStorage.getItem("gameState");
  if (savedData) {
    const gameState = JSON.parse(savedData);

    // Restore player's position and coins collected
    player.marker.setLatLng(gameState.position);
    player.coinsCollected = gameState.coinsCollected;
    updateCoinsDisplay(player.coinsCollected);

    // Restore cache states
    gameState.cacheStates.forEach(
      ([gridCellKey, cacheMemento]: [string, CacheMemento]) => {
        cacheMementoManager.set(gridCellKey, cacheMemento);
      },
    );

    // Update movement history and map view
    movementHistory.push(gameState.position);
    movementPolyline.setLatLngs(movementHistory);
    map.setView(gameState.position, config.initialZoom);

    // Generate caches around restored player position
    generateCachesAroundPlayer();
    console.log("Game state loaded:", gameState);
  } else {
    console.log("No saved game state found.");
  }
}

// Manually load the game state when needed
loadGameState();

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
document.getElementById("automatic")?.addEventListener("click", () => {
  const interval = setInterval(() => {
    const currentLatLng = player.marker.getLatLng();
    const newLat = currentLatLng.lat +
      (Math.random() > 0.2 ? config.tileSize : -config.tileSize);
    const newLng = currentLatLng.lng +
      (Math.random() > 0.2 ? config.tileSize : -config.tileSize);
    updatePlayerLocation(newLat, newLng);
  }, 1000); // Move every second

  // Stop after 10 seconds
  setTimeout(() => clearInterval(interval), 10000);
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

  // Clear and regenerate caches around the starting location
  generateCachesAroundPlayer();
  console.log("Game state has been reset.");
});

// IMPORTANT!
// I didn't know whether we had to import the board.ts for this demo or not
// I didn't use it so this file does not have the board.ts being used
// I'll try adding it this week
