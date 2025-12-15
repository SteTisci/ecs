import type { IComponentRegistry } from '../types/IComponentRegistry.js';

export function createComponentRegistry<K extends string>(): IComponentRegistry<K> {
  const nameToID = new Map<K, number>();
  const IDtoName = new Map<number, K>();
  let nextID: number = 0;

  function register(name: K): void {
    if (!nameToID.has(name)) {
      const eid = nextID++;

      nameToID.set(name, eid);
      IDtoName.set(eid, name);
    }
  }

  function getID(name: K): number {
    const eid = nameToID.get(name);
    if (eid === undefined) throw new Error(`Component ${name} not registered`);

    return eid;
  }

  function getName(cid: number): K {
    const name = IDtoName.get(cid);
    if (!name) throw new Error(`Component ID ${cid} not registered`);

    return name;
  }

  return { register, getID, getName };
}
