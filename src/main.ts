// todo

// @deno-types="npm:@types/leaflet@^1.9.14"
//import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
//import luck from "./luck.ts";

const button = document.createElement("button");
button.innerHTML = "Click here";

button.addEventListener("click", () => {
  alert("You clicked the button! Congrats!!!!!");
});

document.body.appendChild(button);
