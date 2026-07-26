import type { IndexMap, QueryResult, StoreDataMap, StoreMap } from './types/index.js';
import type { IECS } from './types/IEcs.js';
import { ComponentStore } from './ComponentStore.js';
import { EntityManager } from './EntityManager.js';
import { createComponentRegistry } from './utils/ComponentRegistry.js';

export function ECS<T extends Record<string, Record<string, any>>>(): IECS<T> {
  const ComponentRegistry = createComponentRegistry<keyof T & string>();
  const Entities = EntityManager(ComponentRegistry);
  // Null-prototype: component names come from the user, so a component called
  // `toString` or `constructor` must not collide with Object.prototype members.
  const internalStores = Object.create(null) as StoreMap<T>;
  const components = Object.create(null) as StoreDataMap<T>;
  const indices = Object.create(null) as IndexMap<T>;

  // Initialize the structure of the components used
  function defineComponents<K extends readonly (keyof T)[]>(...names: K): void {
    for (const name of names) {
      if (Object.hasOwn(internalStores, name as string))
        throw new Error(`Component ${String(name)} is already defined`);

      ComponentRegistry.register(name as string);
      internalStores[name] = ComponentStore<T[typeof name]>();
      components[name] = internalStores[name].getData();
      indices[name] = internalStores[name].getSparse();
    }
  }

  function createEntity(): number {
    return Entities.create();
  }

  function destroyEntity(eid: number): void {
    const entityMask = Entities.getMask(eid);

    let cid = 0;
    let tempMask = entityMask;

    // Bit operation on the entity mask to track the corresponding components and remove them
    while (tempMask !== 0n) {
      if ((tempMask & 1n) !== 0n) {
        const name = ComponentRegistry.getName(cid);
        internalStores[name].remove(eid);
      }

      tempMask >>= 1n;
      cid++;
    }

    Entities.remove(eid);
  }

  function addComponent<K extends keyof T>(eid: number, name: K, data: T[K]): void {
    Entities.addComponent(eid, name as keyof T & string);
    internalStores[name].add(eid, data);
  }

  function removeComponent<K extends keyof T>(eid: number, name: K): void {
    Entities.removeComponent(eid, name as keyof T & string);
    internalStores[name].remove(eid);
  }

  // Resolves the target bitmask and picks the smallest store as the iteration pivot,
  // so the scan is bounded by the rarest component rather than by the entity count.
  // Validates that every requested component is registered before touching internalStores,
  // so an unknown name throws a clear error instead of a raw "undefined" access.
  function planQuery<C extends (keyof T)[]>(componentName: C) {
    let targetMask = 0n;
    for (const name of componentName) {
      targetMask |= 1n << BigInt(ComponentRegistry.getID(name as keyof T & string));
    }

    let pivot = internalStores[componentName[0]];
    let pivotSize = pivot.getSize();

    for (let i = 1; i < componentName.length; i++) {
      const store = internalStores[componentName[i]];
      const size = store.getSize();

      if (size < pivotSize) {
        pivot = store;
        pivotSize = size;
      }
    }

    return { targetMask, pivot };
  }

  // Generator function to retrive the indexes of the entity components searched
  function* query<C extends (keyof T)[]>(...componentName: C): Generator<QueryResult<C>> {
    if (componentName.length === 0) return;

    const { targetMask, pivot } = planQuery(componentName);

    // Hoist the per-component lookups out of the entity loop: resolving internalStores[name]
    // and calling getIndex() once per entity per component dominated this loop's cost.
    // The sparse tables are mutated in place, never replaced, so the references stay valid.
    const count = componentName.length;
    const sparses = new Array<number[]>(count);
    for (let i = 0; i < count; i++) sparses[i] = internalStores[componentName[i]].getSparse();

    // Iterate a snapshot of the dense array: systems commonly call removeComponent or
    // destroyEntity while iterating, and swap-and-pop would move an unvisited entity into
    // a slot the iterator has already passed, silently skipping it. The snapshot fixes the
    // result set at call time, so entities added mid-iteration are picked up by the next query.
    const entities = [...pivot.getDense()];

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];

      // One lookup covers both cases: undefined means the entity was destroyed since the
      // snapshot was taken, a mismatching mask means it no longer carries every component.
      const mask = Entities.tryGetMask(eid);
      if (mask === undefined || (mask & targetMask) !== targetMask) continue;

      const result = {} as any;

      for (let c = 0; c < count; c++) {
        result[componentName[c]] = { id: sparses[c][eid] };
      }

      yield result as QueryResult<C>;
    }
  }

  // Allocation-free counterpart to query(): returns the matching entity IDs instead of
  // yielding one result object plus one { id } object per component per entity. Callers
  // translate an entity ID into a storage index through the `indices` tables.
  function queryIds<C extends (keyof T)[]>(...componentName: C): number[] {
    const matches: number[] = [];
    if (componentName.length === 0) return matches;

    const { targetMask, pivot } = planQuery(componentName);
    const dense = pivot.getDense();

    // The result is fully materialised before returning, so unlike query() this needs no
    // snapshot: the caller cannot mutate the world part-way through the scan.
    for (let i = 0; i < dense.length; i++) {
      const eid = dense[i];

      const mask = Entities.tryGetMask(eid);
      if (mask === undefined || (mask & targetMask) !== targetMask) continue;

      matches.push(eid);
    }

    return matches;
  }

  return {
    defineComponents,
    createEntity,
    destroyEntity,
    addComponent,
    removeComponent,
    query,
    queryIds,
    components,
    indices,
  };
}
