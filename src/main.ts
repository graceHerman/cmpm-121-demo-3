// todo
/*
Deterministically generate an offering of coins to collect at each location.
Represent the player’s location and
nearby cache locations on the map with details visible either as tooltips or popups.
Allow the player transport coins from one cache to another
by collecting and depositing (using buttons in the cache’s popups).
*/

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
};

// Initialize the map
const map = initializeMap();

// Player object for tracking location and collected coins
const player = {
  marker: leaflet.marker(config.startLocation),
  coinsCollected: 0,
};

// Set up player marker and display
initializePlayerMarker(player);
updateCoinsDisplay(player.coinsCollected);

// Generate caches around the player's location
generateCachesAroundPlayer();

// Create a sample button to demonstrate functionality in `main.ts`
const demoButton = document.createElement("button");
demoButton.innerHTML = "Click here";
demoButton.addEventListener("click", () => alert("You clicked the button!"));
document.body.appendChild(demoButton);

// ---------------------------------------------------------------
// Function Definitions

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

// Generates caches around the player's location based on the probability configuration
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

// Creates a cache at a specific location and binds interactive popups
function spawnCache(row: number, col: number) {
  const origin = config.startLocation;
  const cacheBounds = leaflet.latLngBounds(
    [origin.lat + row * config.tileSize, origin.lng + col * config.tileSize],
    [
      origin.lat + (row + 1) * config.tileSize,
      origin.lng + (col + 1) * config.tileSize,
    ],
  );

  const cacheRect = leaflet.rectangle(cacheBounds);
  cacheRect.addTo(map);

  // Initialize a cache with a random point value
  let cacheValue = Math.floor(luck([row, col, "value"].toString()) * 100);

  // Bind a popup to the cache with collect and deposit functionality
  cacheRect.bindPopup(() => {
    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <div>Cache at (${row},${col}): <span id="value">${cacheValue}</span> coins.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>
    `;

    // Handle collect button click to gather coins from the cache
    popupContent.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (cacheValue > 0) {
          cacheValue--;
          player.coinsCollected++;
          updateCoinsDisplay(player.coinsCollected);
        }
      },
    );

    // Handle deposit button click to deposit coins into the cache
    popupContent.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (player.coinsCollected > 0) {
          cacheValue++;
          player.coinsCollected--;
          updateCoinsDisplay(player.coinsCollected);
        }
      },
    );

    return popupContent;
  });
}
