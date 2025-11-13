import * as T from "./types.js"


/*
This file contains constants that should be configured 
for each deployment of turtlemaps.
*/

/**
 * Used for requests, in case the API needs to throttle your usage
 */
export const REFERER = "https://www.stvn.us/pages/contact";

// Default zoom level
export const DZ: T.OSMZoomLevels = 15 as const;

// How long are you willing to wait?
export const LOC_TIMEOUT_MILLIS = 4 * 1000;  // Wait for location data (from Nominatim)
export const MAP_TIMEOUT_MILLIS = 15 * 1000;  // Wait for map data (from OSM Overpass)