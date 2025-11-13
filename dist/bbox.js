export class BBox {
    /*
    Cordinates and bounding boxes are confusing because they are formatted
    differently by different organizations.  For example, OSM Overpass and
    Nominatum define bbox differently!
  
    OSM Overpass: left, bottom, right, top
    Nominatum:    bottom, top, left, right
  
    This class aims to make things a little less ambiguous.
  
    More info: https://wiki.openstreetmap.org/wiki/Bounding_box
    */
    // Current values
    bottom = null;
    left = null;
    top = null;
    right = null;
    // Original values
    oBottom = null;
    oLeft = null;
    oTop = null;
    oRight = null;
    oWidth = null;
    oHeight = null;
    constructor(bbox) {
        if (bbox) {
            this.parseOSMBbox(bbox);
        }
    }
    /**
     * "Original" values (those prefixed with `o`) are overwritten with current
     */
    overwriteOriginal() {
        [this.oBottom, this.oLeft, this.oTop, this.oRight] = [this.bottom, this.left, this.top, this.right];
        this.oWidth = this.width;
        this.oHeight = this.height;
    }
    /**
     *
     * Parse values and overwrite 'original' values
     */
    parseOSMBbox(bbox) {
        this.bottom = bbox.minlat;
        this.left = bbox.minlon;
        this.top = bbox.maxlat;
        this.right = bbox.maxlon;
        this.overwriteOriginal();
    }
    /**
     *
     * Parse values and overwrite 'original' values
     */
    parseLatitudeFirst(bbox) {
        // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
        [this.bottom, this.left, this.top, this.right] = bbox;
        this.overwriteOriginal();
    }
    /*
    Crop or re-crop the original bbox to match the SVG aspect ratio
    */
    crop(svgWidth, svgHeight) {
        if (this.isValid()) {
            // Map bbox width to svg width in order to test height
            let testHeight = this.oWidth * svgHeight / svgWidth;
            // If box is wider than it is tall
            if (testHeight < svgHeight) {
                // Get the width that matches the svg aspect ratio
                const newBboxWidth = this.oHeight * svgWidth / svgHeight;
                // Crop the left and right from the box
                const center = (this.oLeft + this.oRight) / 2;
                this.left = center - (newBboxWidth / 2);
                this.right = center + (newBboxWidth / 2);
            }
            else {
                // Get the height that matches the svg aspect ratio
                const newBboxHeight = this.oWidth * svgHeight / svgWidth;
                // Crop top and bottom from the box
                const center = (this.oBottom + this.oTop) / 2;
                this.bottom = center - (newBboxHeight / 2);
                this.top = center + (newBboxHeight / 2);
            }
        }
    }
    isValid() {
        return (typeof this.bottom === "number" &&
            typeof this.left === "number" &&
            typeof this.top === "number" &&
            typeof this.right === "number" &&
            typeof this.oBottom === "number" &&
            typeof this.oLeft === "number" &&
            typeof this.oTop === "number" &&
            typeof this.oRight === "number" &&
            typeof this.oWidth === "number" &&
            typeof this.oHeight === "number");
    }
    // TODO: NOT WORKING, DO NOT USE
    // Positive numbers are required for width and height
    // "Values for width or height lower or equal to 0 disable rendering of the element."
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
    get svgViewBox() {
        return [this.left, this.bottom, this.width, this.height].join(" ");
    }
    get width() {
        if (this.left !== null && this.right !== null) {
            return Math.abs(this.right - this.left);
        }
        else {
            throw new Error("Not initialized");
        }
    }
    get height() {
        if (this.top !== null && this.bottom !== null) {
            return Math.abs(this.top - this.bottom);
        }
        else {
            throw new Error("Not initialized");
        }
    }
    /**
     * Per the [Overpass Language Guide wiki](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide)
     * "Bounding box clauses always start with the lowest latitude (southernmost)
     * followed by lowest longitude (westernmost), then highest latitude
     * (northernmost) then highest longitude (easternmost)."
     */
    get overpassBbox() {
        return [this.bottom, this.left, this.top, this.right].join(",");
    }
}
