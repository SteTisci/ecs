/**
 * Interface used for fast entity lookups, insertion and removal.
 *
 * Maintain two parallel arrays:
 *
 * - sparse: a direct lookup table that maps an entity ID (eid) to its index in the dense array.
 * - dense: a compact array that stores all active entity IDs contiguously.
 */
export interface ISparseSet {
  /**
   * Check if an entity ID exists in the set
   * @param eid The entity ID to check
   * @returns True if the entity ID exists, false otherwise
   */
  has: (eid: number) => boolean;

  /**
   * Add the entity ID to the set
   * @param eid The entity ID to add
   * @thows Error if the entity ID is already been added
   */
  add: (eid: number) => void;

  /**
   * Remove an Entity ID from the set
   * @param eid The entity ID to remove
   * @throws Error if the ID does not exists in the set
   */
  remove: (eid: number) => void;

  /**
   * Retrive the index of the entity ID in the set
   * @param eid The entity ID
   * @returns The index corresponding to an entity ID in the set
   */
  getIndex: (eid: number) => number;

  /**
   * Retrive the full dense array that contain all the entity IDs of the set
   * @returns an Array with all the current entity IDs
   */
  getDense: () => number[];

  /**
   * Retrive the size representing the number of active entities in the set.
   * @returns The current size of the Dense array
   */
  getSize: () => number;
}
