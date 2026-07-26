import type { IComponentStore } from './types/IComponentStore.js';
import type { ComponentDataArrays } from './types/index.js';
import { SparseSet } from './utils/SparseSet.js';

const INITIAL_CAPACITY = 8;

// Float32Array has a fixed length, so numeric fields grow by doubling capacity
// (like a dynamic array reallocation) instead of relying on push/pop.
function grow(buffer: Float32Array, requiredIndex: number): Float32Array {
  // A zero-length buffer would make the doubling loop below spin forever
  let capacity = buffer.length || INITIAL_CAPACITY;
  while (capacity <= requiredIndex) capacity *= 2;

  const grown = new Float32Array(capacity);
  grown.set(buffer);
  return grown;
}

// Internally every field is either a Float32Array (numeric) or a plain array (anything else).
// The precise, per-field ComponentDataArrays<T> type is only applied at the public getData() boundary.
type FieldStore = Float32Array | unknown[];

export function ComponentStore<T extends Record<string, any>>(): IComponentStore<T> {
  const componentSet = SparseSet();

  // Null-prototype: field names are user-supplied, so a field called `toString` or
  // `constructor` must not resolve to an inherited Object.prototype member.
  const componentData: Record<string, FieldStore> = Object.create(null);

  // Tracks which fields are numeric (Float32Array-backed) vs plain arrays, keyed by field name
  const isNumeric: Record<string, boolean> = Object.create(null);

  function add(eid: number, data: T): void {
    if (componentSet.has(eid)) throw new Error(`Entity ${eid} already has this component`);

    // Use the current size (next index) to maintain data coherence with the dense array
    const ID = componentSet.getSize();

    componentSet.add(eid);

    // Store each property of the component into its corresponding array
    for (const key in data) {
      const value = data[key];

      if (!(key in componentData)) {
        isNumeric[key] = typeof value === 'number';
        componentData[key] = isNumeric[key] ? new Float32Array(INITIAL_CAPACITY) : [];
      }

      if (isNumeric[key] && ID >= componentData[key].length) {
        componentData[key] = grow(componentData[key] as Float32Array, ID);
      }

      (componentData[key] as unknown[])[ID] = value;
    }
  }

  function remove(eid: number): void {
    if (!componentSet.has(eid)) throw new Error(`Entity ${eid} does not have this component`);

    const ID = componentSet.getIndex(eid);
    const lastID = componentSet.getSize() - 1;

    // Swap the component data only if is not the last one inserted
    if (ID !== lastID) {
      for (const key of Object.keys(componentData)) {
        (componentData[key] as unknown[])[ID] = componentData[key][lastID];
      }
    }

    componentSet.remove(eid);

    // Plain arrays are trimmed to release references and stay in sync with the dense array.
    // Float32Array slots beyond the current size are simply unused (unreachable via query/getIndex),
    // so there's nothing to release and the capacity is kept as-is.
    for (const key in componentData) {
      if (!isNumeric[key]) {
        (componentData[key] as unknown[]).pop();
      }
    }
  }

  function getDense(): number[] {
    return componentSet.getDense();
  }

  function getData(): ComponentDataArrays<T> {
    return componentData as ComponentDataArrays<T>;
  }

  function getIndex(eid: number): number {
    return componentSet.getIndex(eid);
  }

  function getSize(): number {
    return componentSet.getSize();
  }

  function getSparse(): number[] {
    return componentSet.getSparse();
  }

  return { add, remove, getIndex, getDense, getData, getSize, getSparse };
}
