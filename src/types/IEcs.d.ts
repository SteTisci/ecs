import type { ComponentSpec, IndexMap, QueryResult, StoreDataMap } from './index.js';

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
   *
   * Each declaration is either the bare component name, or the long form
   * `{ name, schema?, capacity? }` when the storage type of a field or the initial
   * capacity matters:
   *
   * ```ts
   * World.defineComponents(
   *   'Sprite',
   *   { name: 'Position', schema: { x: 'f64', y: 'f64' }, capacity: 100_000 },
   *   { name: 'Health', schema: { current: 'u16', max: 'u16' } },
   * );
   * ```
   *
   * A numeric field with no declared type is stored as `f32`, which carries about 7
   * significant digits and stops representing consecutive integers exactly past 2^24.
   *
   * @param specs - component names, or long-form declarations
   * @throws Error if a component name is already defined
   */
  defineComponents(...specs: ComponentSpec<T>[]): void;

  /**
   * Pre-allocates entity slots and component storage for the expected world size.
   *
   * Storage grows on demand regardless, so this is purely an optimisation — but it has a
   * second effect worth knowing: growing a numeric field allocates a new typed array and
   * replaces `components.X.y`. Code that caches a field array in a local and then adds
   * components writes into a stale buffer, silently and without an error. Reserving
   * enough capacity up front keeps cached references valid.
   *
   * @param capacity - The number of entities to make room for
   */
  reserve(capacity: number): void;

  /**
   * Creates a new entity in the ECS.
   * @returns The ID of the newly created entity
   */
  createEntity: () => number;

  /**
   * Completely removes an entity and all its components from the ECS.
   * Cleans up all component data and entity records.
   * @param eid - The entity ID to destroy
   * @throws Error if the entity doesn't exist
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
   *
   * This is the ergonomic form: it builds one result object plus one `{ id }` object per
   * component per entity, so it allocates on every iteration. It measures about 1.8x
   * slower than `queryIds` with twice the garbage — fine for setup, editor tooling or
   * systems that touch few entities, worth avoiding in a system that runs every frame.
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

  /**
   * Same query as `queryIds`, writing into an array the caller owns instead of allocating
   * a new one. A system running at 60fps over 100k entities allocates several megabytes a
   * second through `queryIds`; keeping one buffer alive across frames removes that.
   *
   * ```ts
   * const buffer: number[] = [];
   *
   * function movementSystem(World) {
   *   for (const eid of World.queryIdsInto(buffer, 'Position', 'Velocity')) { ... }
   * }
   * ```
   *
   * @template C - Array of component names to query for
   * @param out - The array to fill; it is truncated first
   * @param componentName - List of component names that the entity must include
   * @returns The same array, holding the matching entity IDs
   */
  queryIdsInto: <C extends (keyof T)[]>(out: number[], ...componentName: C) => number[];

  components: StoreDataMap<T>;

  /**
   * Maps each component name to its sparse lookup table, translating an entity ID into
   * that entity's index in the component's data arrays. Needed to read `components`
   * when iterating the output of queryIds. Only entries for entities that hold the
   * component are meaningful; anything else reads as -1 or undefined.
   */
  indices: IndexMap<T>;
}
