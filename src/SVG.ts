import * as T from "./types.js";
import { Color } from "./color.js";
import { U, DataError } from "./main.js";

/**
 * SVG utility functions
 */
export class SVG {
  $svg: SVGElement;

  constructor(
    public $container: HTMLElement,
    public width: number,
    public height: number
  ) {
    let svg = SVG.makeElement("svg");
    svg.setAttribute("width", String(this.width));
    svg.setAttribute("height", String(this.height));
    svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);

    // Background shape
    let rect = SVG.makeElement("rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(this.width));
    rect.setAttribute("height", String(this.height));
    rect.setAttribute("fill", Color.default.bg);
    svg.append(rect);

    this.$svg = svg;
    this.$container.append(svg);
  }

  static makeElement(type: "svg" | "rect" | "circle" | "polygon" | "path" | "g"): SVGElement {
    return document.createElementNS("http://www.w3.org/2000/svg", type);
  }

  /**
   * Draw a path with or without inner boundaries
   * @param points List of points or nested list of points
   *
   * @todo
   */
  static makePath(points: T.Point[] | T.Point[][]): SVGPathElement {
    /*
    - If `points` is an array of points, (typeof points[0][0] is a number)
      - push command using makeSVGPathCommand
    - Else (`points` is an nested array of points):
      - for each array of points:
        - push to commands (same as above)
    - add commands to path
    - return path
    */
    const path = SVG.makeElement("path") as SVGPathElement;
    let commands: string = "";

    // Handle simple list of points
    if (SVG.isListOfPoints(points)) {
      commands = SVG.PathCommand(points);
      path.setAttribute("d", commands);
      if (SVG.pathIsOpen(points)) {
        path.setAttribute("fill", "none");
      }
      return path;
    }

    // Otherwise, handle nested list of points
    for (let listOfPoints of points) {
      commands += SVG.PathCommand(listOfPoints);
    }
    path.setAttribute("d", commands);
    path.setAttribute("fill-rule", "evenodd");

    if (SVG.pathIsOpen(points[0])) {
      path.setAttribute("fill", "none");
    }
    return path;

  }

  static isListOfPoints(arr: T.Point[] | T.Point[][]): arr is T.Point[] {
    if (Array.isArray(arr[0][0])) { // eg [[[0,1], [0,1]], [[3,4]]]
      return false;
    }
    return true;
  }

  /**
   * @param points Points that form the boundary to be tested
   * @param maxOpen The threshold at which the path is considered "open"
   */
  static pathIsOpen(points: T.Point[], maxOpen = 0.05): boolean {
    const first = points[0];
    const last = points[points.length - 1];

    if (U.dist(first[0], first[1], last[0], last[1]) > maxOpen) {
      return true;
    }
    return false;
  }

  /**
   * From a list of points `[x, y]`, form and return a "Command string" as described by
   * [MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths#curve_commands)
   *
   * @remarks
   * - Command strings may be joined by a space to form shapes with inner boundaries.
   * - First command is always a "M"
   * - Relative coordinates are NOT supported
   */
  static PathCommand(points: T.Point[], close = false): string {
    if (points.length < 2) {
      throw new DataError("At least 2 points are required");
    }

    // First command is always "M" (move to)
    let commands: string[] = [`M ${points[0][0]},${points[0][1]}`];

    // Subsequent commands are always "L" (line to)
    for (let i = 1; i < points.length; i++) {
      commands.push(`L ${points[i][0]},${points[i][1]}`);
    }

    return commands.join(" ");
  }
}
