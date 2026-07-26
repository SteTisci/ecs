import type { IComponentRegistry } from './types/IComponentRegistry.js';
import type { IEntityManager } from './types/IEntityManager.js';

export function EntityManager<K extends string>(registry: IComponentRegistry<K>): IEntityManager<K> {
  let nextID: number = 0;
  const recycledIDs: number[] = [];
  const bitMasks: bigint[] = [];

  function exists(eid: number): boolean {
    const isWithinBounds = eid >= 0 && eid < nextID;
    const hasMask = bitMasks[eid] !== undefined;

    return isWithinBounds && hasMask;
  }

  function hasComponent(eid: number, name: K): boolean {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    const cid = registry.getID(name);
    return (bitMasks[eid] & (1n << BigInt(cid))) !== 0n;
  }

  function create(): number {
    const ID = recycledIDs.length > 0 ? recycledIDs.pop()! : nextID++;
    bitMasks[ID] = 0n;

    return ID;
  }

  function remove(eid: number): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    bitMasks[eid] = undefined as any;
    recycledIDs.push(eid);
  }

  function addComponent(eid: number, name: K): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exists`);
    if (hasComponent(eid, name)) throw new Error(`Entity ${eid} already has component ${name}`);

    const cid = registry.getID(name);
    bitMasks[eid] |= 1n << BigInt(cid);
  }

  function removeComponent(eid: number, name: K): void {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exists`);
    if (!hasComponent(eid, name)) throw new Error(`Entity ${eid} does not have component ${name}`);

    const cid = registry.getID(name);
    bitMasks[eid] &= ~(1n << BigInt(cid));
  }

  function getMask(eid: number): bigint {
    if (!exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    return bitMasks[eid];
  }

  // Hot-loop variant of getMask: reports a missing entity through the return value
  // instead of throwing, so a query needs one call per entity rather than an
  // exists() check followed by a getMask() that re-runs the same check.
  function tryGetMask(eid: number): bigint | undefined {
    return eid >= 0 && eid < nextID ? bitMasks[eid] : undefined;
  }

  return { exists, hasComponent, create, remove, addComponent, removeComponent, getMask, tryGetMask };
}
