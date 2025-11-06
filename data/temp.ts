// To parse this data:
//
//   import { Convert, Temp } from "./file";
//
//   const temp = Convert.toTemp(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface Temp {
    version:   number;
    generator: string;
    osm3s:     Osm3S;
    elements:  Element[];
    bbox:      number[];
    centroid:  number[];
}

export interface Element {
    type:      Type;
    id:        number;
    bounds:    Bounds;
    nodes?:    number[];
    geometry?: Geometry[];
    tags:      { [key: string]: string };
    members?:  Member[];
}

export interface Bounds {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
}

export interface Geometry {
    lat: number;
    lon: number;
}

export interface Member {
    type:     Type;
    ref:      number;
    role:     Role;
    geometry: Geometry[];
}

export enum Role {
    Inner = "inner",
    Outer = "outer",
}

export enum Type {
    Relation = "relation",
    Way = "way",
}

export interface Osm3S {
    timestamp_osm_base: Date;
    copyright:          string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toTemp(json: string): Temp {
        return cast(JSON.parse(json), r("Temp"));
    }

    public static tempToJson(value: Temp): string {
        return JSON.stringify(uncast(value, r("Temp")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "Temp": o([
        { json: "version", js: "version", typ: 3.14 },
        { json: "generator", js: "generator", typ: "" },
        { json: "osm3s", js: "osm3s", typ: r("Osm3S") },
        { json: "elements", js: "elements", typ: a(r("Element")) },
        { json: "bbox", js: "bbox", typ: a(3.14) },
        { json: "centroid", js: "centroid", typ: a(3.14) },
    ], false),
    "Element": o([
        { json: "type", js: "type", typ: r("Type") },
        { json: "id", js: "id", typ: 0 },
        { json: "bounds", js: "bounds", typ: r("Bounds") },
        { json: "nodes", js: "nodes", typ: u(undefined, a(0)) },
        { json: "geometry", js: "geometry", typ: u(undefined, a(r("Geometry"))) },
        { json: "tags", js: "tags", typ: m("") },
        { json: "members", js: "members", typ: u(undefined, a(r("Member"))) },
    ], false),
    "Bounds": o([
        { json: "minlat", js: "minlat", typ: 3.14 },
        { json: "minlon", js: "minlon", typ: 3.14 },
        { json: "maxlat", js: "maxlat", typ: 3.14 },
        { json: "maxlon", js: "maxlon", typ: 3.14 },
    ], false),
    "Geometry": o([
        { json: "lat", js: "lat", typ: 3.14 },
        { json: "lon", js: "lon", typ: 3.14 },
    ], false),
    "Member": o([
        { json: "type", js: "type", typ: r("Type") },
        { json: "ref", js: "ref", typ: 0 },
        { json: "role", js: "role", typ: r("Role") },
        { json: "geometry", js: "geometry", typ: a(r("Geometry")) },
    ], false),
    "Osm3S": o([
        { json: "timestamp_osm_base", js: "timestamp_osm_base", typ: Date },
        { json: "copyright", js: "copyright", typ: "" },
    ], false),
    "Role": [
        "inner",
        "outer",
    ],
    "Type": [
        "relation",
        "way",
    ],
};
