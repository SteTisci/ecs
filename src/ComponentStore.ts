import type { IComponentStore } from './types/IComponentStore.js';
import type { ComponentDataArrays } from './types/index.js';
import { SparseSet } from './utils/SparseSet.js';

export function ComponentStore<T extends Record<string, any>>(): IComponentStore<T> {
  const componentSet = SparseSet();
  const componentData = {} as ComponentDataArrays<T>;

  function add(eid: number, data: T): void {
    if (componentSet.has(eid)) throw new Error(`Entity ${eid} already has this component`);

    // Use the current size (next index) to maintain data coherence with the dense array
    const ID = componentSet.getSize();

    componentSet.add(eid);

    // Store each property of the component into its corresponding array
    for (const key in data) {
      if (!componentData[key]) {
        componentData[key] = [] as T[typeof key][];
      }
      componentData[key][ID] = data[key];
    }
  }

  function remove(eid: number): void {
    if (!componentSet.has(eid)) throw new Error(`Entity ${eid} does not have this component`);

    const ID = componentSet.getIndex(eid);
    const lastID = componentSet.getSize() - 1;

    // Swap the component data only if is not the last one inserted
    if (ID !== lastID) {
      for (const key of Object.keys(componentData)) {
        componentData[key][ID] = componentData[key][lastID];
      }
    }

    componentSet.remove(eid);

    // Keep component arrays dense and in sync with the SparseSet's dense array
    for (const key in componentData) {
      componentData[key].pop();
    }
  }

  function getDense(): number[] {
    return componentSet.getDense();
  }

  function getData(): ComponentDataArrays<T> {
    return componentData;
  }

  function getIndex(eid: number): number {
    return componentSet.getIndex(eid);
  }

  function getSize(): number {
    return componentSet.getSize();
  }

  return { add, remove, getIndex, getDense, getData, getSize };
}
