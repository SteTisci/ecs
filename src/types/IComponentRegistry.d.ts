/**
 * Interface for managing component registration and ID mapping.
 * Provides a centralized registry that maps component names to unique IDs
 * and vice versa, used for efficient bitmask operations in the ECS.
 */
export interface IComponentRegistry<K extends string> {
  /**
   * Registers a new component by name.
   * Assigns a unique incremental ID to the component if not already registered.
   * @param name - The name of the component to register
   */
  register: (name: K) => void;

  /**
   * Retrieves the unique ID associated with a component name.
   * @param name - The name of the component
   * @returns The unique ID assigned to the component
   * @throws Error if the component is not registered
   */
  getID: (name: K) => number;

  /**
   * Retrieves the component name associated with a given ID.
   * @param cid - The unique ID of the component
   * @returns The name of the component
   * @throws Error if the ID is not registered
   */
  getName: (cid: number) => K;
}
