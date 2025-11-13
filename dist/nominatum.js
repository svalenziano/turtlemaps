import { REFERER } from "./config.js";
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
/**
 * A simple interface for the Nominatum API:
 * https://nominatim.org/release-docs/latest/api/Overview/
 *
 * @remarks
 * API providers: https://wiki.openstreetmap.org/wiki/Nominatim#Alternatives_.2F_Third-party_providers
 * Check the provider's usage policy before using their service!
 */
export class Nominatum {
    fetcher;
    api;
    constructor(fetcher, api = Nominatum.PATHS.osmfoundation) {
        this.fetcher = fetcher;
        this.api = api;
        fetcher = fetcher.bind(this);
    }
    static PATHS = {
        'osmfoundation': "https://nominatim.openstreetmap.org/search?", // Very limited throughput.  Do not use unless absolutely necessary
        "geocoding.ai": "https://nominatim.geocoding.ai/search?", // geocoding.ai (defunct as of late 2025?)
    };
    async resolveCoordinates(query, zoom = 17) {
        let centroid;
        if (Nominatum.isLatLon(query)) {
            centroid = Nominatum.parseLatLon(query);
        }
        else {
            const json = await this.freeFormQuery(query);
            centroid = Nominatum.extractCentroid(json);
        }
        const bbox = Nominatum.toBbox(centroid, zoom);
        return { bbox, centroid };
    }
    /**
   * Convert `[lat, lon]` point and `zoom` value to bounding box.
   *
   * @remarks
   * Zoom levels: https://wiki.openstreetmap.org/wiki/Zoom_levels
   *
   * @param zoom Number between 0 (whole world) and 20 (mid-sized building)
   */
    static toBbox({ lat, lon }, zoom) {
        /*
        Zoom levels: https://wiki.openstreetmap.org/wiki/Zoom_levels
        tktk: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Implementations
        */
        const earthRadius = 6378137; // meters
        const earthCircumference = 2 * Math.PI * earthRadius;
        // Calculate the pixel size at the given zoom level
        const pixelsPerTile = 256;
        const metersPerPixel = earthCircumference / (pixelsPerTile * (2 ** zoom));
        // Convert meters to degrees (approximate)
        const metersPerDegreeLat = 111320; // meters per degree of latitude
        const metersPerDegreeLon = Math.abs(Math.cos(lat * Math.PI / 180) * metersPerDegreeLat);
        // Calculate half-width and half-height of the bounding box
        const halfWidth = (pixelsPerTile / 2) * metersPerPixel / metersPerDegreeLon;
        const halfHeight = (pixelsPerTile / 2) * metersPerPixel / metersPerDegreeLat;
        // Calculate bounding box coordinates
        const minlon = Number((lon - halfWidth).toFixed(4));
        const maxlon = Number((lon + halfWidth).toFixed(4));
        const minlat = Number((lat - halfHeight).toFixed(4));
        const maxlat = Number((lat + halfHeight).toFixed(4));
        return { minlat, minlon, maxlat, maxlon };
    }
    async freeFormQuery(queryString) {
        const params = ["q=" + encodeURIComponent(queryString)];
        params.push("format=geojson"); // required to obtain centroid
        const response = await this.fetcher(this.api + params.join("&"), {
            headers: {
                "Referer": REFERER,
            }
        });
        const json = await response.json();
        return json;
    }
    /**
     * Extracts centroid from GEOJson-formatted response
     *
     * Expects GeoJSON to be formatted like so:
     *
     * ```
     * {
     *    ...
     *    "features": [
     *        {
     *            "type": "Feature",
     *            ...
     *            "geometry": {
     *                "type": "Point",
     *                "coordinates": [
     *                    -78.8751582,
     *                    36.0181316
     *                ]
     *            }
     *        }
     *    ]
     *}
     * ```
     * @param json JSON response from Nominatum API
     * @returns coordinates of top-ranked location
     */
    static extractCentroid(json) {
        if (!json.features) {
            console.error("Features not found.  Here's the response:");
            console.error(json);
            throw new Error("API response was unexpected");
        }
        const geo = json.features[0]?.geometry;
        if (typeof geo === "object" &&
            geo.type === "Point" &&
            Array.isArray(geo.coordinates)) {
            const [lon, lat] = geo.coordinates;
            return { lat, lon };
        }
        else {
            throw new Error("API response was unexpected");
        }
    }
    /**
     * Extracts bbox from GEOJson-formatted response
     *
     * Expects GeoJSON to be formatted like so:
     *
     * ```
     * {
     *    ...
     *    "features": [
     *        {
     *            ...
     *            "bbox": [
     *               -79.0074981,
     *               35.8663508,
     *               -78.7569111,
     *               36.1370099
     *             ],
     *        }
     *    ]
     * }
     * ```
     * @param json JSON response from Nominatum API
     * @returns bbox of top-ranked location
     */
    static extractBbox(json) {
        throw new Error("Not implemented");
    }
    static isLatLon(s) {
        return /(-?\d+\.\d+),\s*(-?\d+\.\d+)/.test(s.trim());
    }
    static parseLatLon(s) {
        const [lat, lon] = s.split(",")
            .map(str => str.trim())
            .map(str => Number(str));
        if (lat < -90 || lat > 90) {
            throw new Error("Latitude must be between -90 and 90");
        }
        else if (lon < -180 || lon > 180) {
            throw new Error("Longitude must be between -180 and 180");
        }
        else {
            return { lat, lon };
        }
    }
}
