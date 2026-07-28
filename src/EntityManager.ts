import type { IComponentRegistry } from './types/IComponentRegistry.js';
import type { IEntityManager } from './types/IEntityManager.js';

const INITIAL_CAPACITY = 1024;

export function EntityManager<K extends string>(registry: IComponentRegistry<K>): IEntityManager<K> {
  let nextID: number = 0;
  let capacity: number = INITIAL_CAPACITY;
  const recycledIDs: number[] = [];

  // Component membership is a multi-word bitset stored one *plane* per 32 components:
  // planes[w][eid] holds bits [w*32, w*32+32) of entity `eid`'s mask.
  //
  // The masks used to be BigInt. Every BigInt operation allocates on the heap, so a query
  // allocated one object per entity scanned and `1n << BigInt(cid)` allocated two per
  // membership check — invisible garbage produced on every frame by every system.
  // Int32Array words are SMIs and allocate nothing.
  //
  // Splitting per word instead of striding one flat array means registering the 33rd
  // component only pushes a new plane; it never has to restride the existing data.
  // Int32Array rather than Uint32Array so that a mask holding bit 31 compares equal to a
  // target holding bit 31: `&` yields a signed int32 either way.
  let planes: Int32Array[] = [new Int32Array(capacity)];

  // A live entity is a 1 here. The mask alone cannot answer the question: an entity with
  // no components and a destroyed entity both have an all-zero mask.
  let alive: Uint8Array = new Uint8Array(capacity);

  function growCapacity(required: number): void {
    let grown = capacity;
    while (grown <= required) grown *= 2;

    const grownAlive = new Uint8Array(grown);
    grownAlive.set(alive);
    alive = grownAlive;

    for (let w = 0; w < planes.length; w++) {
      const plane = new Int32Array(grown);
      plane.set(planes[w]);
      planes[w] = plane;
    }

    capacity = grown;
  }

  // Planes are added lazily: a component that is registered but never attached to an
  // entity never forces the allocation of its word.
  function ensurePlane(word: number): void {
    while (planes.length <= word) planes.push(new Int32Array(capacity));
  }

  function clearMask(eid: number): void {
    for (let w = 0; w < planes.length; w++) planes[w][eid] = 0;
  }

  function exists(eid: number): boolean {
    return eid >= 0 && eid < nextID && alive[eid] === 1;
  }

  function hasComponent(eid: number, name: K): boolean {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    const cid = registry.getID(name);
    const word = cid >>> 5;

    if (word >= planes.length) return false;
    return (planes[word][eid] & (1 << (cid & 31))) !== 0;
  }

  function create(): number {
    const ID = recycledIDs.length > 0 ? recycledIDs.pop()! : nextID++;

    if (ID >= capacity) growCapacity(ID);

    alive[ID] = 1;
    clearMask(ID);

    return ID;
  }

  function remove(eid: number): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    alive[eid] = 0;
    clearMask(eid);
    recycledIDs.push(eid);
  }

  // addComponent and removeComponent resolve the component ID and test the bit inline
  // instead of delegating to hasComponent(), which would repeat the exists() check and
  // the registry lookup on a path that runs once per component per entity.
  function addComponent(eid: number, name: K): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exists`);

    const cid = registry.getID(name);
    const word = cid >>> 5;
    const bit = 1 << (cid & 31);

    ensurePlane(word);
    const plane = planes[word];

    if ((plane[eid] & bit) !== 0) throw new Error(`Entity ${eid} already has component ${name}`);

    plane[eid] |= bit;
  }

  function removeComponent(eid: number, name: K): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exists`);

    const cid = registry.getID(name);
    const word = cid >>> 5;
    const bit = 1 << (cid & 31);

    const plane = word < planes.length ? planes[word] : undefined;
    if (plane === undefined || (plane[eid] & bit) === 0)
      throw new Error(`Entity ${eid} does not have component ${name}`);

    plane[eid] &= ~bit;
  }

  // Membership test for the query loop: one call per entity covers both "is this entity
  // still alive" and "does it carry every requested component", and it allocates nothing.
  // The planes are read through this closure rather than handed out directly because
  // growCapacity replaces the arrays, and a caller holding a stale reference would read
  // from a dead buffer.
  function matches(eid: number, target: Int32Array): boolean {
    if (eid < 0 || eid >= nextID || alive[eid] === 0) return false;

    // Fast path: up to 32 components the target is a single word, which is the shape
    // every query has in practice. Word 0 always exists, so it needs no bounds check.
    const bits = target[0];
    if ((planes[0][eid] & bits) !== bits) return false;

    for (let w = 1; w < target.length; w++) {
      const high = target[w];
      if (high === 0) continue;

      // No plane means no entity carries any component of this word
      if (w >= planes.length) return false;
      if ((planes[w][eid] & high) !== high) return false;
    }

    return true;
  }

  function getMaskWord(eid: number, word: number): number {
    return word < planes.length ? planes[word][eid] : 0;
  }

  function getWordCount(): number {
    return planes.length;
  }

  function reserve(count: number): void {
    if (count > capacity) growCapacity(count - 1);
  }

  return {
    exists,
    hasComponent,
    create,
    remove,
    addComponent,
    removeComponent,
    matches,
    getMaskWord,
    getWordCount,
    reserve,
  };
}
