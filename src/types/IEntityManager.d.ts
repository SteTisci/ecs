/**
 * Interface for managing entities and their component associations.
 * Uses bitmasks to efficiently track which components each entity has,
 * enabling fast component checks and queries.
 *
 * A mask is a multi-word bitset: word `w` holds the components with IDs
 * [w*32, w*32+32). Words are plain int32 numbers, so no bitwise operation on a mask
 * allocates.
 */
export interface IEntityManager<K extends string> {
  /**
   * Checks if an entity exists in the system.
   * @param eid - The entity ID to check
   * @returns True if the entity exists, false otherwise
   */
  exists: (eid: number) => boolean;

  /**
   * Checks if an entity has a specific component.
   * Uses bitwise operations on the entity's bitmask for fast lookups.
   * @param eid - The entity ID
   * @param name - The component name
   * @returns True if the entity has the component, false otherwise
   */
  hasComponent: (eid: number, name: K) => boolean;

  /**
   * Creates a new entity.
   * Recycles entity IDs when possible, otherwise assigns a new incremental ID.
   * @returns The ID of the newly created entity
   */
  create: () => number;

  /**
   * Removes an entity from the system.
   * Marks the entity ID for recycling.
   * @param eid - The entity ID to remove
   * @throws Error if the entity doesn't exist
   */
  remove: (eid: number) => void;

  /**
   * Adds a component flag to an entity's bitmask.
   * Updates the entity's bitmask to indicate it has the specified component.
   * @param eid - The entity ID
   * @param name - The component name
   * @throws Error if the entity doesn't exist or already has the component
   */
  addComponent: (eid: number, name: K) => void;

  /**
   * Removes a component flag from an entity's bitmask.
   * Updates the entity's bitmask to indicate it no longer has the specified component.
   * @param eid - The entity ID
   * @param name - The component name
   * @throws Error if the entity doesn't exist or doesn't have the component
   */
  removeComponent: (eid: number, name: K) => void;

  /**
   * Membership test for hot loops: reports whether the entity is alive *and* carries
   * every component set in the target mask. Allocates nothing, so it can be called once
   * per entity scanned.
   * @param eid - The entity ID
   * @param target - The requested components, as a multi-word bitset
   * @returns True if the entity is alive and holds every requested component
   */
  matches: (eid: number, target: Int32Array) => boolean;

  /**
   * Reads a single word of an entity's bitmask, for callers that need to walk the
   * components an entity owns rather than test a fixed set.
   * @param eid - The entity ID
   * @param word - The word index, covering component IDs [word*32, word*32+32)
   * @returns The bits of that word, or 0 if the word was never allocated
   */
  getMaskWord: (eid: number, word: number) => number;

  /**
   * Number of words currently backing the entity masks, i.e. the upper bound for
   * `getMaskWord`.
   * @returns The mask width in 32-bit words
   */
  getWordCount: () => number;

  /**
   * Pre-allocates room for the given number of entity IDs.
   * Storage grows on demand anyway; this only avoids the repeated copies of doubling.
   * @param count - The number of entity slots to make room for
   */
  reserve: (count: number) => void;
}
