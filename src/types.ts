// For disambuigating coordinates
export type minLat = number;
export type minLon = number;
export type maxLat = number;
export type maxLon = number;



export type bboxArray = [number, number, number, number];

export type Point = [number, number];

export type GenericObject = {[key: string]: string};

export type DefaultLayer = {
  name: string;
  colorFill: string | null;
  colorLine: string | null;
  strokeWeight: number;
  tags: {
    [key: string]: string[] | null;
  }
}