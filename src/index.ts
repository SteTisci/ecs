export { ECS } from './Ecs.js';

// Without IECS in the public surface, `export const World = ECS<Components>()` fails to
// compile with TS4023: the inferred type names IECS, which the consumer cannot reference.
export type { IECS } from './types/IEcs.js';

export type { IComponentStore } from './types/IComponentStore.js';
export type { IComponentRegistry } from './types/IComponentRegistry.js';
export type { IEntityManager } from './types/IEntityManager.js';
export type { ISparseSet } from './types/ISparseSet.js';

export type {
  ComponentDataArrays,
  ComponentDefinition,
  ComponentSchema,
  ComponentSpec,
  FieldType,
  IndexMap,
  NumericArray,
  QueryResult,
  StoreDataMap,
  StoreMap,
} from './types/index.js';
