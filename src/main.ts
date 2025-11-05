// TYPES
type bboxArray = [number, number, number, number];


function makeSVGElement(type: "svg" | "rect" | "circle" | "polygon" | "path" | "g"): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", type);
}

class MapApp {
  data: object;  // TODO - import OSM types
  bbox: bboxArray | null;
  query: string | null;
  centroid: [number, number] | null;

  constructor() {
    this.data = {};
    this.bbox = null;
    this.query = null;
    this.centroid = null;
  }

  async init() {
    const response = await fetch("./data/durham_nc.json");
    const json = await response.json();
    this.bbox = json.bbox;
    this.centroid = json.centroid;

    const elements: OSMElement[] = json.elements
  }
}

class svgMap {

}

document.addEventListener("DOMContentLoaded", () => {
  const WIDTH = "300";
  const HEIGHT = "300";

  const svg = makeSVGElement("svg");
  svg.setAttribute("width", WIDTH);
  svg.setAttribute("height", HEIGHT);
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

  const rect = makeSVGElement("rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", WIDTH);
  rect.setAttribute("height", HEIGHT);
  rect.setAttribute("fill", "red");
  svg.append(rect)

  document.body.append(svg);
})