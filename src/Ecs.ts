import type {
  ComponentDefinition,
  ComponentSchema,
  ComponentSpec,
  IndexMap,
  QueryResult,
  StoreDataMap,
  StoreMap,
} from './types/index.js';
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
  function defineComponents(...specs: ComponentSpec<T>[]): void {
    for (const spec of specs) {
      // A declaration is either the bare component name or the long form carrying a
      // per-field schema and an initial capacity.
      const isDefinition = typeof spec === 'object' && spec !== null;
      const definition = spec as ComponentDefinition<T, keyof T>;

      const name = (isDefinition ? definition.name : spec) as keyof T & string;
      const schema = isDefinition ? definition.schema : undefined;
      const capacity = isDefinition ? definition.capacity : undefined;

      if (Object.hasOwn(internalStores, name))
        throw new Error(`Component ${String(name)} is already defined`);

      ComponentRegistry.register(name);

      const store = ComponentStore<T[typeof name]>(
        schema as ComponentSchema<T[typeof name]> | undefined,
        capacity,
      );

      internalStores[name] = store;
      components[name] = store.getData();
      indices[name] = store.getSparse();
    }
  }

  // Pre-allocates entity slots and component storage for the expected world size.
  // Everything grows on demand anyway, but growing a numeric field replaces its typed
  // array, so reserving up front both avoids the repeated copies of doubling from the
  // default capacity and keeps a cached `components.X.y` reference valid.
  function reserve(capacity: number): void {
    Entities.reserve(capacity);

    for (const name in internalStores) {
      internalStores[name].reserve(capacity);
    }
  }

  function createEntity(): number {
    return Entities.create();
  }

  function destroyEntity(eid: number): void {
    if (!Entities.exists(eid)) throw new Error(`Entity ${eid} does not exist`);

    // Walk only the bits that are set: `word & -word` isolates the lowest one, so the
    // loop runs once per component the entity owns instead of once per bit position up
    // to the highest one set.
    const words = Entities.getWordCount();

    for (let w = 0; w < words; w++) {
      let word = Entities.getMaskWord(eid, w);

      while (word !== 0) {
        const lowest = word & -word;
        const cid = (w << 5) + 31 - Math.clz32(lowest);

        internalStores[ComponentRegistry.getName(cid)].remove(eid);

        word ^= lowest;
      }
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
    const count = componentName.length;
    const cids = new Array<number>(count);
    let maxCid = 0;

    for (let i = 0; i < count; i++) {
      const cid = ComponentRegistry.getID(componentName[i] as keyof T & string);

      cids[i] = cid;
      if (cid > maxCid) maxCid = cid;
    }

    // The mask is sized from the highest requested component ID, not from the entity mask
    // width: a component that is defined but never attached to anything has no plane yet,
    // and its bit still has to be part of the target so nothing matches it.
    const targetMask = new Int32Array((maxCid >>> 5) + 1);
    for (let i = 0; i < count; i++) {
      targetMask[cids[i] >>> 5] |= 1 << (cids[i] & 31);
    }

    let pivot = internalStores[componentName[0]];
    let pivotSize = pivot.getSize();

    for (let i = 1; i < count; i++) {
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

      // One call covers both cases: a destroyed entity is reported as not matching, and so
      // is one that no longer carries every requested component.
      if (!Entities.matches(eid, targetMask)) continue;

      const result = {} as any;

      for (let c = 0; c < count; c++) {
        result[componentName[c]] = { id: sparses[c][eid] };
      }

      yield result as QueryResult<C>;
    }
  }

  // Shared scan behind queryIds and queryIdsInto. The result is fully materialised before
  // returning, so unlike query() this needs no snapshot: the caller cannot mutate the
  // world part-way through.
  function collectIds<C extends (keyof T)[]>(out: number[], componentName: C): number[] {
    let found = 0;

    if (componentName.length > 0) {
      const { targetMask, pivot } = planQuery(componentName);
      const dense = pivot.getDense();
      const size = pivot.getSize();

      for (let i = 0; i < size; i++) {
        const eid = dense[i];

        if (!Entities.matches(eid, targetMask)) continue;

        // Write into the slot rather than push: a reused buffer already owns its backing
        // store, and truncating it first would make every frame reallocate it from empty.
        out[found++] = eid;
      }
    }

    out.length = found;
    return out;
  }

  // Allocation-free counterpart to query(): returns the matching entity IDs instead of
  // yielding one result object plus one { id } object per component per entity. Callers
  // translate an entity ID into a storage index through the `indices` tables.
  function queryIds<C extends (keyof T)[]>(...componentName: C): number[] {
    return collectIds([], componentName);
  }

  // Same scan, writing into an array the caller owns. A system that keeps one buffer alive
  // across frames stops allocating a fresh result array 60 times a second.
  function queryIdsInto<C extends (keyof T)[]>(out: number[], ...componentName: C): number[] {
    return collectIds(out, componentName);
  }

  return {
    defineComponents,
    reserve,
    createEntity,
    destroyEntity,
    addComponent,
    removeComponent,
    query,
    queryIds,
    queryIdsInto,
    components,
    indices,
  };
}
