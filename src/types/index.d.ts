/**
 * Represents component data in Structure of Arrays (SoA) format.
 * Each property of the component is stored in a separate array,
 * enabling cache-efficient iteration and SIMD operations.
 * @template T - The component data type
 * @example
 * // For Position component: { x: number, y: number }
 * // ComponentDataArrays would be: { x: number[], y: number[] }
 */
export type ComponentDataArrays<T> = {
  [K in keyof T]: T[K][];
};
