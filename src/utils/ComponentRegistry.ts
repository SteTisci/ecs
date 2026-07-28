import type { IComponentRegistry } from '../types/IComponentRegistry.js';

export function createComponentRegistry<K extends string>(): IComponentRegistry<K> {
  const nameToID = new Map<K, number>();

  // IDs are handed out sequentially, so the reverse direction is a plain array indexed by
  // component ID rather than a Map: destroyEntity resolves a name for every component an
  // entity owns, and an array index is cheaper than a hash lookup.
  const IDtoName: K[] = [];

  function register(name: K): void {
    if (!nameToID.has(name)) {
      const cid = IDtoName.length;

      nameToID.set(name, cid);
      IDtoName.push(name);
    }
  }

  function getID(name: K): number {
    const cid = nameToID.get(name);
    if (cid === undefined) throw new Error(`Component ${name} not registered`);

    return cid;
  }

  function getName(cid: number): K {
    const name = IDtoName[cid];
    if (name === undefined) throw new Error(`Component ID ${cid} not registered`);

    return name;
  }

  return { register, getID, getName };
}
