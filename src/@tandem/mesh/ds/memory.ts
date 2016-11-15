import * as sift from "sift";
import { BaseDataStore } from "./base";
import { ReadableStream, DuplexStream } from "@tandem/mesh/core";
import { DSFind, DSFindAll, DSInsert, DSRemove, DSUpdate, DSMessage } from "./messages";

export class MemoryDataStore extends BaseDataStore {

  private _data: {
    [Identifier: string]: any[]
  };

  constructor() {
    super();
    this._data = {};
  }

  dsFind({ type, collectionName, query }: DSFind<any>) {
    return DuplexStream.fromArray(this.getCollection(collectionName).find(sift(query) as any));
  }

  dsInsert({ type, collectionName, data }: DSInsert<any>) {
    let ret = JSON.parse(JSON.stringify(data));
    ret = Array.isArray(ret) ? ret : [ret];
    this.getCollection(collectionName).push(...ret);
    return DuplexStream.fromArray(ret);
  }

  dsRemove({ type, collectionName, query }: DSRemove<any>) {
    const collection = this.getCollection(collectionName);
    const filter = sift(query) as any;
    const ret = [];
    for (let i = collection.length; i--;) {
      const item = collection[i];
      if (filter(item)) {
        ret.push(item);
        collection.splice(i, 1);
      }
    }
    return DuplexStream.fromArray(ret);
  }

  dsUpdate({ type, collectionName, query, data }: DSUpdate<any, any>) {
    const collection = this.getCollection(collectionName);
    const filter = sift(query) as any;
    const ret = [];
    for (let i = collection.length; i--;) {
      const item = collection[i];
      if (filter(item)) {
        Object.assign(item, JSON.parse(JSON.stringify(data)));
        ret.push(item);
      }
    }

    return DuplexStream.fromArray(ret);
  }

  private getCollection(collectionName: string) {
    return this._data[collectionName] || (this._data[collectionName] = []);
  }
}