import { Color } from "./color.js";
import { SVG } from "./SVG.js";
export class Layer {
    /**
    Provides a direct interface to an SVG layer
  
  
    */
    $g;
    name;
    colorFill;
    colorStroke;
    strokeWeight;
    tags;
    constructor(options) {
        this.name = options.name;
        this.colorFill = options.colorFill;
        this.colorStroke = options.colorStroke;
        this.strokeWeight = options.strokeWeight;
        this.tags = options.tags;
        this.$g = SVG.makeElement("g");
        this.updateStyles();
    }
    /**
     * Create and return an array of layers created with `this.defaultLayers`
     */
    static makeDefaultLayers() {
        return Layer.defaultLayers.map((options) => new Layer(options));
    }
    /**
     * Apply / re-apply styles to this.$g
     */
    updateStyles() {
        this.$g.setAttribute("fill", this.colorFill ?? "none");
        this.$g.setAttribute("stroke", this.colorStroke ?? "none");
        this.$g.setAttribute("stroke-width", this.strokeWeight ? String(this.strokeWeight) : "0");
    }
    /**
     * Does this layer match the provided tags?
     * @param tags eg `{
        "destination:street":"Chapel Hill Street",
        "highway":"motorway_link",
        "lanes":"1",
        "oneway":"yes",
        "surface":"concrete"
        }`
     */
    matchesTags(tags) {
        /*
        input =
          - tags = tags object from OSM response, eg: {"destination:street":"Chapel Hill Street","highway":"motorway_link","lanes":"1","oneway":"yes","surface":"concrete"}
          - this.tags = eg {"leisure":["park","garden"],"landuse":["grass"]}
        return = boolean
        */
        for (let [eleKey, eleTag] of Object.entries(tags)) {
            if (Object.keys(this.tags).includes(eleKey) && (this.tags[eleKey] === null || this.tags[eleKey].includes(eleTag))) {
                return true;
            }
        }
        return false;
    }
    addGeometry(ele) {
        this.$g.append(ele);
    }
    get queryString() {
        let string = "";
        for (const key in this.tags) {
            const tags = this.tags[key];
            if (tags === null) {
                string += `wr["${key}"];`;
            }
            else if (tags.length > 1) {
                string += `wr["${key}"~"${tags.join("|")}"];`;
            }
            else {
                string += `wr["${key}"="${tags[0]}"];`;
            }
        }
        return string;
    }
    static strokesWeights = {
        faint: 0.3,
        light: 0.5,
        medium: 1.3,
        heavy: 2.5,
        super: 4,
    };
    /**
      *  Parse order: as listed (first elements in the array are processed first)
      *  Draw order: reverse order (first elements in the array are drawn last)
      */
    static defaultLayers = [
        {
            name: "Buildings - Residential",
            colorFill: Color.default.bright,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                building: ["house", "residential", "detached", "apartments", "semidetached_house", "bungalow", "dormitory"],
            },
        },
        {
            name: "Buildings - All",
            colorFill: Color.default.dark,
            colorStroke: Color.default.bright,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                building: null,
            },
        },
        {
            name: "Paths",
            colorFill: Color.default.bg,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                highway: ["footway", "service", "driveway", "path", "pedestrian"],
            },
        },
        {
            name: "Primary Roads",
            colorFill: null,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.super,
            tags: {
                highway: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",]
            },
        },
        {
            name: "Secondary Roads",
            colorFill: null,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.heavy,
            tags: {
                highway: ["secondary", "secondary_link", "tertiary", "tertiary_link",]
            },
        },
        {
            name: "Tertiary Roads",
            colorFill: null,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.medium,
            tags: {
                highway: ["residential", "service"]
            },
        },
        {
            name: "Paths",
            colorFill: null,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.light,
            tags: {
                highway: ["footway", "service", "driveway"]
            },
        },
        {
            name: "Water",
            colorFill: Color.default.blue,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                waterway: null,
                natural: ["water"],
            },
        },
        {
            name: "Green Space",
            colorFill: Color.default.green,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                leisure: ["park", "garden"],
                landuse: ["grass"],
            },
        },
        {
            name: "Public Space",
            colorFill: Color.default.green,
            colorStroke: Color.default.dark,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                leisure: ["village_green", "track", "dog_park"],
                amenity: ["school"],
            }
        },
        {
            name: "Parking",
            colorFill: Color.default.ick,
            colorStroke: Color.default.bg,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                parking: null,
                parking_space: null,
                amenity: ["parking"],
                building: ["parking", "parking_garage", "parking_shelter", "car_park", "parkingbuilding", "parking_deck"]
            }
        },
        {
            name: "No Tresspassing",
            colorFill: Color.default.bright,
            colorStroke: null,
            strokeWeight: this.strokesWeights.faint,
            tags: {
                access: ["private"],
            },
        },
    ];
}
