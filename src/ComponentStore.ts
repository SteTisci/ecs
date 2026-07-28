import type { IComponentStore } from './types/IComponentStore.js';
import type { ComponentDataArrays, ComponentSchema, FieldType, NumericArray } from './types/index.js';
import { SparseSet } from './utils/SparseSet.js';

const INITIAL_CAPACITY = 8;

// Storage type declared for a field, resolved to its typed array constructor.
// Undeclared numeric fields default to f32, which is what every numeric field used to be.
const DEFAULT_FIELD_TYPE: FieldType = 'f32';

type NumericArrayConstructor = new (length: number) => NumericArray;

const NUMERIC_ARRAY: Record<FieldType, NumericArrayConstructor> = {
  i8: Int8Array,
  u8: Uint8Array,
  i16: Int16Array,
  u16: Uint16Array,
  i32: Int32Array,
  u32: Uint32Array,
  f32: Float32Array,
  f64: Float64Array,
};

// Internally every field is either a typed array (numeric) or a plain array (anything else).
// The precise, per-field ComponentDataArrays<T> type is only applied at the public getData() boundary.
type FieldStore = NumericArray | unknown[];

export function ComponentStore<T extends Record<string, any>>(
  schema?: ComponentSchema<T>,
  capacity: number = INITIAL_CAPACITY,
): IComponentStore<T> {
  const componentSet = SparseSet();

  // Null-prototype: field names are user-supplied, so a field called `toString` or
  // `constructor` must not resolve to an inherited Object.prototype member.
  const componentData: Record<string, FieldStore> = Object.create(null);

  // Field names split by storage kind, built once when a field is declared. remove() used
  // to call Object.keys(componentData) on every removal (~7.4 ns per component per entity);
  // a component's set of fields never changes after the first add, so the lists are stable.
  const numericKeys: string[] = [];
  const objectKeys: string[] = [];
  const numericCtor: Record<string, NumericArrayConstructor> = Object.create(null);

  // All numeric fields are indexed by the same dense ID, so they share one capacity and
  // one bounds check instead of one per field.
  let numericCapacity = capacity > 0 ? capacity : INITIAL_CAPACITY;

  function declareNumeric(key: string, type: FieldType): void {
    const ctor = NUMERIC_ARRAY[type];

    numericKeys.push(key);
    numericCtor[key] = ctor;
    componentData[key] = new ctor(numericCapacity);
  }

  function declareObject(key: string): void {
    objectKeys.push(key);
    componentData[key] = [];
  }

  // Declared fields exist at their full width before the first add, so a system can read
  // `world.components.X.y` on an empty world instead of getting `undefined`.
  if (schema !== undefined) {
    for (const key in schema) {
      const type = schema[key] as FieldType | undefined;
      if (type !== undefined) declareNumeric(key, type);
    }
  }

  // Typed arrays have a fixed length, so numeric fields grow by doubling capacity
  // (like a dynamic array reallocation) instead of relying on push/pop.
  // NOTE: this replaces the array object, so anything holding `componentData[key]`
  // directly sees a stale buffer afterwards. Use reserve() to size the store up front
  // when caching a field array.
  function ensureNumericCapacity(required: number): void {
    if (required <= numericCapacity) return;

    let grown = numericCapacity || INITIAL_CAPACITY;
    while (grown < required) grown *= 2;

    for (let i = 0; i < numericKeys.length; i++) {
      const key = numericKeys[i];
      const data = new numericCtor[key](grown);
      data.set(componentData[key] as NumericArray);
      componentData[key] = data;
    }

    numericCapacity = grown;
  }

  function add(eid: number, data: T): void {
    if (componentSet.has(eid)) throw new Error(`Entity ${eid} already has this component`);

    // Use the current size (next index) to maintain data coherence with the dense array
    const ID = componentSet.getSize();

    componentSet.add(eid);

    // Fields the schema did not cover are declared from the first value written
    for (const key in data) {
      if (componentData[key] === undefined) {
        if (typeof data[key] === 'number') declareNumeric(key, DEFAULT_FIELD_TYPE);
        else declareObject(key);
      }
    }

    if (ID >= numericCapacity) ensureNumericCapacity(ID + 1);

    // Store each property of the component into its corresponding array
    for (const key in data) {
      (componentData[key] as unknown[])[ID] = data[key];
    }
  }

  function remove(eid: number): void {
    if (!componentSet.has(eid)) throw new Error(`Entity ${eid} does not have this component`);

    const ID = componentSet.getIndex(eid);
    const lastID = componentSet.getSize() - 1;

    // Swap the component data only if is not the last one inserted
    if (ID !== lastID) {
      for (let i = 0; i < numericKeys.length; i++) {
        const data = componentData[numericKeys[i]] as NumericArray;
        data[ID] = data[lastID];
      }

      for (let i = 0; i < objectKeys.length; i++) {
        const data = componentData[objectKeys[i]] as unknown[];
        data[ID] = data[lastID];
      }
    }

    componentSet.remove(eid);

    // Plain arrays are trimmed to release references and stay in sync with the dense array.
    // Numeric slots beyond the current size are simply unused (unreachable via query/getIndex),
    // so there's nothing to release and the capacity is kept as-is.
    for (let i = 0; i < objectKeys.length; i++) {
      (componentData[objectKeys[i]] as unknown[]).pop();
    }
  }

  function reserve(count: number): void {
    ensureNumericCapacity(count);
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

  return { add, remove, reserve, getIndex, getDense, getData, getSize, getSparse };
}
