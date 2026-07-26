import type { IComponentStore } from './IComponentStore.js';

/**
 * Represents component data in Structure of Arrays (SoA) format.
 * Each property of the component is stored in a separate array,
 * enabling cache-efficient iteration and SIMD operations.
 * Numeric properties are backed by a Float32Array for a compact, homogeneous
 * memory layout; non-numeric properties fall back to a plain JS array.
 * @template T - The component data type
 * @example
 * // For Position component: { x: number, y: number }
 * // ComponentDataArrays would be: { x: Float32Array, y: Float32Array }
 */
export type ComponentDataArrays<T> = {
  [K in keyof T]: T[K] extends number ? Float32Array : T[K][];
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
 * Type helper for the query result.
 * Creates an object with an entry for each requested component, holding its store index.
 * @template C - Array of the component names requested in the query.
 */
export type QueryResult<C extends readonly PropertyKey[]> = {
  [K in C[number]]: { id: number };
};
