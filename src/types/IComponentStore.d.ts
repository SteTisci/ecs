import type { ComponentDataArrays } from './index.js';

/**
 * Interface for storing and managing component data using Structure of Arrays (SoA) pattern.
 * Each component type has its own store that maintains entity-component associations
 * and stores component data in separate arrays per property for cache efficiency.
 * @template T - The component data type (object with properties)
 */
export interface IComponentStore<T> {
  /**
   * Adds a component to an entity with the provided data.
   * Stores each property of the component in separate arrays for efficient iteration.
   * @param eid - The entity ID to add the component to
   * @param data - The component data to store
   * @throws Error if the entity already has this component
   */
  add: (eid: number, data: T) => void;

  /**
   * Removes a component from an entity.
   * Uses swap-and-pop technique to maintain dense arrays.
   * @param eid - The entity ID to remove the component from
   * @throws Error if the entity doesn't have this component
   */
  remove: (eid: number) => void;

  /**
   * Gets the index of an entity's component data in the dense arrays.
   * @param eid - The entity ID
   * @returns The index in the data arrays where this entity's component data is stored
   */
  getIndex: (eid: number) => number;

  /**
   * Returns the dense array of entity IDs that have this component.
   * Useful for efficient iteration over all entities with this component.
   * @returns Array of entity IDs
   */
  getDense: () => number[];

  /**
   * Returns the component data arrays organized by property.
   * Each property of the component type has its own array.
   * @returns Object mapping property names to their value arrays
   */
  getData: () => ComponentDataArrays<T>;

  /**
   * Returns the number of entities that have this component.
   * @returns The count of entities with this component
   */
  getSize: () => number;
}
