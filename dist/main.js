"use strict";
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// TYPES
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/////////////////////////////////////////////////////////////////////////////
// OSM Types
var OSMElementType;
(function (OSMElementType) {
    OSMElementType["Node"] = "node";
    OSMElementType["Way"] = "way";
    OSMElementType["Relation"] = "relation";
})(OSMElementType || (OSMElementType = {}));
;
;
// CLASSES
class BBox {
    constructor() {
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
        this.bottom = null;
        this.left = null;
        this.top = null;
        this.right = null;
        // Original values
        this.oBottom = null;
        this.oLeft = null;
        this.oTop = null;
        this.oRight = null;
        this.oWidth = null;
        this.oHeight = null;
    }
    parseLatitudeFirst(bbox) {
        // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
        [this.bottom, this.left, this.top, this.right] = bbox;
        [this.oBottom, this.oLeft, this.oTop, this.oRight] = bbox;
        this.oWidth = this.width;
        this.oHeight = this.height;
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
}
function makeSVGElement(type) {
    return document.createElementNS("http://www.w3.org/2000/svg", type);
}
function makeSVGPath(points, maxOpen = 0.01) {
    /*
    maxOpen = if start and end points are separated by a minimum of this distance
      the shape will not be filled
    */
    const path = makeSVGElement("path");
    if (points.length < 2) {
        throw new Error("At least 2 points are required");
    }
    let commands = [`M ${points[0][0]},${points[0][1]}`];
    for (let i = 1; i < points.length; i++) {
        commands.push(`L ${points[i][0]},${points[i][1]}`);
    }
    // console.log(commands)
    path.setAttribute("d", commands.join(" "));
    const lastPoint = points[points.length - 1];
    if (U.dist(points[0][0], points[0][1], lastPoint[0], lastPoint[1])) {
        path.setAttribute("fill", "none");
    }
    return path;
}
// Utility functions
class U {
    // Based on p5js implementation https://github.com/processing/p5.js/blob/44341795ec65d956b9efe3290da478519dcf01bd/src/math/calculation.js#L605
    static map(val, start1, stop1, start2, stop2, withinBounds = false) {
        const newval = (val - start1) / (stop1 - start1) * (stop2 - start2) + start2;
        if (!withinBounds) {
            return newval;
        }
        if (start2 < stop2) {
            return this.constrain(newval, start2, stop2);
        }
        else {
            return this.constrain(newval, stop2, start2);
        }
    }
    ;
    static constrain(val, min, max) {
        if (min >= max)
            throw new Error("Min should be less than max");
        if (val <= min)
            return min;
        if (val >= max)
            return max;
        else
            return val;
    }
    static dist(x1, y1, x2, y2) {
        return Math.hypot(x1 - x2, y1 - y2);
    }
    static saveSVG(svg) {
        if (!svg) {
            const s = document.querySelector("svg");
            if (!s)
                throw new Error("SVG was not provided");
            svg = s;
        }
        let data = (new XMLSerializer()).serializeToString(svg);
        let svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(svgBlob);
        triggerDownload(url);
        function triggerDownload(imgURI, filename = "image.svg") {
            let a = document.createElement('a');
            a.setAttribute('download', filename);
            a.setAttribute('href', imgURI);
            a.setAttribute('target', '_blank');
            a.click();
        }
    }
}
class MapApp {
    constructor() {
        this.svgWidth = window.innerWidth;
        this.svgHeight = window.innerWidth;
        this.data = {};
        this.bbox = new BBox();
        this.query = null;
        this.centroid = null;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch("./data/durham_nc.json");
            const json = yield response.json();
            if (json.bbox) {
                this.bbox.parseLatitudeFirst(json.bbox);
            }
            else {
                throw new Error("no bbox was found");
            }
            this.centroid = json.centroid;
            const elements = json.elements;
            // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
            const svg = makeSVGElement("svg");
            svg.setAttribute("width", String(this.svgWidth));
            svg.setAttribute("height", String(this.svgHeight));
            svg.setAttribute("viewBox", `0 0 ${this.svgWidth} ${this.svgHeight}`);
            // this.bbox.crop(this.svgWidth, this.svgHeight);
            let rect = makeSVGElement("rect");
            rect.setAttribute("x", String(0));
            rect.setAttribute("y", String(0));
            rect.setAttribute("width", String(this.svgWidth));
            rect.setAttribute("height", String(this.svgHeight));
            rect.setAttribute("fill", "rgba(153, 6, 167, 1)");
            svg.append(rect);
            let g = makeSVGElement("g");
            // g.setAttribute("transform", "scale(1, -1)");
            g.setAttribute("stroke", "white");
            g.setAttribute("fill", "none");
            g.setAttribute("stroke-width", "3");
            svg.append(g);
            // Diagonal top left to bottom right
            // let path = makeSVGPath([[this.bbox.minLon, this.bbox.maxLat], [this.bbox.maxLon, this.bbox.minLat]]);
            // let path = makeSVGPath([[0, 0], [this.svgWidth, this.svgHeight]]);
            // g.append(path);
            // test the cropBox
            // if (this.bbox.isValid()) {
            //   rect = makeSVGElement("rect");
            //   rect.setAttribute("x", String(U.map(this.bbox.left, this.bbox.left, this.bbox.right, 0, this.svgWidth)));
            //   rect.setAttribute("y", String(U.map(this.bbox.top, this.bbox.top, this.bbox.bottom, 0, this.svgHeight)));
            //   rect.setAttribute("width", String(this.svgWidth));
            //   rect.setAttribute("height", String(this.svgHeight));
            //   rect.setAttribute("stroke", "blue");
            //   rect.setAttribute("fill", "none");
            //   rect.setAttribute("stroke-width", "6");
            //   svg.append(rect);
            // } else {
            //   throw new Error("uh oh")
            // }
            g = makeSVGElement("g");
            // g.setAttribute("transform", "scale(1, -1)");
            g.setAttribute("stroke", "rgba(80, 0, 0, 1)");
            g.setAttribute("fill", "rgba(255, 82, 241, 0.27)");
            g.setAttribute("stroke-width", "0.5");
            svg.append(g);
            // debugger;
            for (let ele of elements) {
                if (ele.type !== "way")
                    continue;
                const mappedPoints = ele.geometry.map((point) => {
                    return this.mapOSMPoint(point);
                }).map(OSMPoint => [OSMPoint.lon, OSMPoint.lat]);
                const shape = makeSVGPath(mappedPoints);
                g.append(shape);
            }
            document.body.append(svg);
        });
    }
    mapOSMPoint(pt, precision = 3) {
        if (!this.bbox.isValid())
            throw new Error("Only works with valid bbox");
        return {
            lat: Number(U.map(pt.lat, this.bbox.top, this.bbox.bottom, 0, this.svgHeight).toFixed(precision)),
            lon: Number(U.map(pt.lon, this.bbox.left, this.bbox.right, 0, this.svgWidth).toFixed(precision))
        };
    }
    mapPoint(pt) {
        if (!this.bbox.isValid())
            throw new Error("Only works with valid bbox");
        return [
            U.map(pt[0], this.bbox.left, this.bbox.right, 0, this.svgWidth),
            U.map(pt[1], this.bbox.top, this.bbox.bottom, 0, this.svgHeight)
        ];
    }
}
class svgMap {
}
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP
document.addEventListener("DOMContentLoaded", () => {
    const app = new MapApp();
    app.init();
});
