/**
 * Interface for managing entities and their component associations.
 * Uses bitmasks to efficiently track which components each entity has,
 * enabling fast component checks and queries.
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
   * @throws Error if the entity doesn't exist
   */
  removeComponent: (eid: number, name: K) => void;

  /**
   * Retrieves the complete bitmask for an entity.
   * The bitmask represents all components the entity has,
   * with each bit corresponding to a component ID.
   * @param eid - The entity ID
   * @returns The entity's component bitmask
   */
  getMask: (eid: number) => bigint;
}
