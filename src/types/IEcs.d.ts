import type { IndexMap, QueryResult, StoreDataMap } from './index.js';

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
   * @param names -component names
   * @throws Error if a component name is already defined
   */
  defineComponents<K extends readonly (keyof T)[]>(...names: K): void;

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
  query: <C extends (keyof T)[]>(...componentName: C) => Generator<QueryResult<C>>;

  /**
   * Allocation-free counterpart to query, for hot systems.
   * Returns the IDs of every entity holding all the specified components, instead of
   * yielding one result object plus one { id } object per component per entity.
   * Translate an entity ID into a storage index through `indices`:
   *
   * ```ts
   * const { Position, Velocity } = World.components;
   * const pos = World.indices.Position;
   * const vel = World.indices.Velocity;
   *
   * for (const eid of World.queryIds('Position', 'Velocity')) {
   *   Position.x[pos[eid]] += Velocity.x[vel[eid]];
   * }
   * ```
   *
   * The array is complete before it is returned, so adding or removing components while
   * looping over it cannot skip an entity. Destroying an entity mid-loop does invalidate
   * its storage index, so guard that case yourself.
   *
   * @template C - Array of component names to query for
   * @param componentName - List of component names that the entity must include
   * @returns A fresh array of matching entity IDs
   */
  queryIds: <C extends (keyof T)[]>(...componentName: C) => number[];

  components: StoreDataMap<T>;

  /**
   * Maps each component name to its sparse lookup table, translating an entity ID into
   * that entity's index in the component's data arrays. Needed to read `components`
   * when iterating the output of queryIds.
   */
  indices: IndexMap<T>;
}
