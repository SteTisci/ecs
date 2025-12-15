import type { QueryResult, StoreDataMap, StoreInit } from './index.js';

/**
 * Interface for the main ECS registry.
 * Provides high-level API for entity-component management,
 * coordinating between EntityManager and ComponentStores.
 * @template T - Record type defining all component types in the ECS
 */
export interface IECS<T> {
  /**
   * Initializes the ECS with component definitions.
   * Registers all components and creates their corresponding stores.
   * Must be called before any other operations.
   * @param components - Object mapping component names to their structure
   */
  defineComponents: (data: StoreInit<T>) => void;

  /**
   * Creates a new entity in the ECS.
   * @returns The ID of the newly created entity
   */
  createEntity: () => number;

  /**
   * Completely removes an entity and all its components from the ECS.
   * Cleans up all component data and entity records.
   * @param eid - The entity ID to destroy
   */
  destroyEntity: (eid: number) => void;

  /**
   * Adds a component to an entity with the provided data.
   * Updates both the entity's bitmask and the component store.
   * @template K - The component name type (key of T)
   * @param eid - The entity ID
   * @param name - The component name
   * @param data - The component data to store
   */
  addComponent: <K extends keyof T>(eid: number, name: K, data: T[K]) => void;

  /**
   * Removes a component from an entity.
   * Updates both the entity's bitmask and the component store.
   * @template K - The component name type (key of T)
   * @param eid - The entity ID
   * @param name - The component name
   */
  removeComponent: <K extends keyof T>(eid: number, name: K) => void;

  /**
   * Retrieves all entities that contain the specified set of components.
   * Performs a filtered search across component stores and yields each matching entity.
   * The returned generator allows efficient iteration without allocating large arrays.
   *
   * @template C - Array of component names to query for
   * @param components - List of component names that the entity must include
   * @returns A generator that yields an object for each matching entity,
   *          containing the entity ID and the related component data
   */
  query: <C extends (keyof T)[]>(...componentName: C) => Generator<QueryResult<T, C>>;

  components: StoreDataMap<T>;
}
