declare module "gaze" {
  function gaze(path:any, watcher:Function):any;
  namespace gaze {

  }
  export = gaze;
}

declare module "package-path" {
  function getPakagePath(rest:any):any;
  namespace getPakagePath {
    function sync(arg:any):any;
  }
  export = getPakagePath;
}

declare module "mesh-array-ds-bus" {
  import { Bus } from "mesh";
  class MeshArrayDsBus extends Bus {
    constructor(target:Array<any>, mutators?:any);
    static create(target:Array<any>, mutators?:any):MeshArrayDsBus;
  }
  namespace MeshArrayDsBus {

  }
  export = MeshArrayDsBus;
}

declare module "mongoid-js" {

  function mongoid(): string;

  namespace mongoid {

  }

  export = mongoid;
}

declare module "react-slider" {

  function ReactSlider();

  namespace ReactSlider {

  }

  export = ReactSlider;
}


declare module "ent" {
  function encode(source: string): string;
  function decode(source: string): string;
}

declare module "react-input-autosize" {
  import * as React from "react";

  class AutosizeInput extends React.Component<any, any> {

  }

  namespace AutosizeInput {

  }

  export = AutosizeInput;
}

declare module "store" {
  export function get(key: string): any;
  export function set(key: string, value: any);
}

declare module "memoizee" {
  function memoize(fn: Function, options?: any);

  namespace memoize {

  }

  export = memoize;
}

declare module "postcss-scss" {
  function parseSass();
  namespace parseSass { }
  export = parseSass;
}

declare module "sass.js" {

  namespace sass {
    export function options(ops: any, callback?: Function);
    export function compile(text: string, options: any, callback: Function);
    export function compileFile(filename: string, options: any, callback: Function);
    export function importer(callback: Function);
  }

  export = sass;
}

declare module "rasterizehtml" {
  namespace rasterizeHTML {
    export function drawDocument(document: HTMLDocument, canvas: HTMLCanvasElement): Promise<any>;
  }
  export = rasterizeHTML;
}

declare module "titlebar" {

  interface ITitlebar {
    appendTo(element: HTMLElement);
    on(event:"close", listener: Function);
    element: HTMLElement;
    destroy();
  }

  function titlebar(): ITitlebar;

  namespace titlebar {

  }

  export = titlebar;
}

declare module "loader-utils" {
  export function parseQuery(query: any): any;
  export function getLoaderConfig(module, name: string): any;
}


declare module "vue-loader" {
  function loader();
  namespace loader {

  }
  export = loader;
}
