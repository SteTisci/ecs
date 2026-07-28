import type { IComponentStore } from './IComponentStore.js';

/**
 * Every typed array a numeric component field can be backed by.
 * Which one is used depends on the field type declared in `defineComponents`;
 * fields without a declared type default to `Float32Array`.
 */
export type NumericArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

/**
 * Storage type of a numeric component field.
 *
 * - `i8` / `u8` / `i16` / `u16` / `i32` / `u32` — exact integers within their range
 * - `f32` — ~7 significant digits (the default when no type is declared)
 * - `f64` — full JS number precision, at twice the memory of `f32`
 *
 * Pick `f64` for values that accumulate without bound (timers, world coordinates in a
 * large map) and an integer type for counters, flags or entity references: `f32` stops
 * representing consecutive integers exactly past 2^24.
 */
export type FieldType = 'i8' | 'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32' | 'f64';

/**
 * Per-field storage declaration for one component.
 * Only numeric fields can be typed; anything else is stored in a plain JS array.
 * Fields left out are inferred from the first value written (numbers become `f32`).
 * @template C - The component data type
 */
export type ComponentSchema<C> = {
  [K in keyof C]?: C[K] extends number ? FieldType : never;
};

/**
 * Long form of a component declaration, for when a plain name is not enough.
 * @template T - Record type defining all component types
 * @template K - The component name
 */
export type ComponentDefinition<T, K extends keyof T> = {
  /** The component name, same value the short form takes. */
  name: K;

  /** Storage type per numeric field. Undeclared fields fall back to `f32`. */
  schema?: ComponentSchema<T[K]>;

  /**
   * Number of component slots to allocate up front. Storage still grows on demand,
   * but pre-sizing avoids the repeated copies of doubling from the default capacity.
   */
  capacity?: number;
};

/**
 * A component declaration accepted by `defineComponents`: either the bare name or the
 * long form carrying a schema and an initial capacity.
 * @template T - Record type defining all component types
 */
export type ComponentSpec<T> = {
  [K in keyof T]: K | ComponentDefinition<T, K>;
}[keyof T];

/**
 * Represents component data in Structure of Arrays (SoA) format.
 * Each property of the component is stored in a separate array,
 * enabling cache-efficient iteration and SIMD operations.
 * Numeric properties are backed by a typed array for a compact, homogeneous memory
 * layout — `Float32Array` unless the field declares another type in `defineComponents`;
 * non-numeric properties fall back to a plain JS array.
 * @template T - The component data type
 * @example
 * // For Position component: { x: number, y: number }
 * // ComponentDataArrays would be: { x: NumericArray, y: NumericArray }
 */
export type ComponentDataArrays<T> = {
  [K in keyof T]: T[K] extends number ? NumericArray : T[K][];
};

/**
 * Maps component names to their corresponding ComponentStore instances.
 * Used internally by CreateWorld to manage all component stores.
 * @template T - Record type defining all component types
 */
export type StoreMap<T> = {
  [K in keyof T]: IComponentStore<T[K]>;
};

/**
 * Maps component names to their data arrays for direct access.
 * Used to expose component data to the user without store methods.
 * @template T - Record type defining all component types
 */
export type StoreDataMap<T> = {
  [K in keyof T]: ComponentDataArrays<T[K]>;
};

/**
 * Maps component names to their raw sparse lookup table.
 * Each table translates an entity ID into that entity's index in the component's
 * data arrays, which is what queryIds callers need to read the SoA storage.
 * Only entries for entities that hold the component are meaningful; anything else reads
 * as -1 or undefined.
 * @template T - Record type defining all component types
 */
export type IndexMap<T> = {
  [K in keyof T]: number[];
};

/**
 * Type helper for the query result.
 * Creates an object with an entry for each requested component, holding its store index.
 * @template C - Array of the component names requested in the query.
 */
export type QueryResult<C extends readonly PropertyKey[]> = {
  [K in C[number]]: { id: number };
};
