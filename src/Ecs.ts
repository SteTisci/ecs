import type { QueryResult, StoreDataMap, StoreMap } from './types/index.js';
import type { IECS } from './types/IEcs.js';
import { ComponentStore } from './ComponentStore.js';
import { EntityManager } from './EntityManager.js';
import { createComponentRegistry } from './utils/ComponentRegistry.js';

export function ECS<T extends Record<string, Record<string, any>>>(): IECS<T> {
  const ComponentRegistry = createComponentRegistry<keyof T & string>();
  const Entities = EntityManager(ComponentRegistry);
  const internalStores = {} as StoreMap<T>;
  const components = {} as StoreDataMap<T>;

  // Initialize the structure of the components used
  function defineComponents(data: Partial<Record<keyof T, any>>): void {
    for (const key in data) {
      ComponentRegistry.register(key);
      internalStores[key] = ComponentStore<T[typeof key]>();
      components[key] = internalStores[key].getData();
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

  // Generator function to retrive the indexes of the entity components searched
  function* query<C extends (keyof T)[]>(...componentName: C): Generator<QueryResult<T, C>> {
    if (componentName.length === 0) return;

    let smallestStore = internalStores[componentName[0]];
    let smallestSize = smallestStore.getSize();

    for (let i = 1; i < componentName.length; i++) {
      const store = internalStores[componentName[i]];
      const size = store.getSize();

      if (size < smallestSize) {
        smallestStore = store;
        smallestSize = size;
      }
    }

    let targetMask = 0n;
    for (const name of componentName) {
      targetMask |= 1n << BigInt(ComponentRegistry.getID(name as keyof T & string));
    }

    for (const eid of smallestStore.getDense()) {
      if ((Entities.getMask(eid) & targetMask) !== targetMask) continue;

      const result = {} as any;

      for (const name of componentName) {
        const id = internalStores[name].getIndex(eid);

        result[name] = { id };
      }

      yield result as QueryResult<T, C>;
    }
  }

  return { defineComponents, createEntity, destroyEntity, addComponent, removeComponent, query, components };
}
