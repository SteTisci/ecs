> [!IMPORTANT]  
> Work in progress.

# ECS in TypeScript

A minimalistic game engine with zero dependencies based on the **Entity Component System (ECS)** architecture implemented in **TypeScript**

## Features

- **ECS architecture** with single responsability principles (SRP)

- **SparSet** for ultra-fast entities lookup

- **Structure of Arrays(SoA)** for optimized memory storage and access — numeric fields are backed by `Float32Array`, non-numeric fields by plain arrays

- **Bitmask** for efficient component queries

## Core Components

- **EntityManager**: Manage creation, destruction and entity recycle. Uses a bitmask to track components of every entity.

- **ComponentStore**: Generic store that maintains component data in SoA format to maximise cache locality — numeric fields in a growable `Float32Array`, non-numeric fields (e.g. `HTMLImageElement`) in a plain array.

- **ECS**: Central Orchestator that coordinates entity and components, expose an API for queries and CRUD operations

- **SparseSet**: Data structure that grants O(1) for insertion, removal and lookups of entities.

## Technologies

- TypeScript for type safety
- Data oriented architecture for optimal performance
- Functional pattern without classes

```typescript
import { ECS } from '@ste_tisci/ecs';

// Define the type of the components
const World = ECS<{
  Position: { x: number; y: number };
  Velocity: { x: number; y: number };
  Size: { width: number; height: number };
  Sprite: { src: HTMLImageElement };
}>();

// Define the structure of components that will be converted to SoA storage.
// Numeric fields become Float32Array, everything else stays a plain array.
// Position = { x: Float32Array, y: Float32Array }
// Sprite   = { src: HTMLImageElement[] }
// etc.
World.defineComponents('Position', 'Velocity', 'Size', 'Sprite');

const ent = World.createEntity();

World.addComponent(ent, 'Position', { x: 100, y: 20 });
World.addComponent(ent, 'Velocity', { x: 2, y: 1 });
World.addComponent(ent, 'Size', { width: 20, height: 20 });

function movementSystem(World) {
  const { Position, Velocity } = World.components;

  for (const entity of World.query('Position', 'Velocity')) {
    const posID = entity.Position.id;
    const velID = entity.Velocity.id;

    Position.x[posID] += Velocity.x[velID];
    Position.y[posID] += Velocity.y[velID];
  }
}

function gameLoop() {
  movementSystem(World);
  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Hot systems: `queryIds`

`query` yields one result object plus one `{ id }` object per component per entity, which is
convenient but allocates on every iteration. For systems that run every frame over many
entities, `queryIds` returns the matching entity IDs instead, and `indices` translates an
entity ID into its slot in the SoA arrays:

```typescript
function movementSystem(World) {
  const { Position, Velocity } = World.components;
  const pos = World.indices.Position;
  const vel = World.indices.Velocity;

  for (const eid of World.queryIds('Position', 'Velocity')) {
    Position.x[pos[eid]] += Velocity.x[vel[eid]];
    Position.y[pos[eid]] += Velocity.y[vel[eid]];
  }
}
```

Both APIs return the same entities; `queryIds` is roughly 3x faster on a packed query and 5x
on a fragmented one, at the cost of resolving indices yourself.

## Iteration and mutation

`query` iterates a snapshot taken when the generator starts, so calling `removeComponent` or
`destroyEntity` from inside the loop cannot skip an entity. Entities created mid-iteration are
not visited by the query in flight; the next call picks them up.

`queryIds` builds its whole result before returning, so the same guarantee holds. Note that
destroying an entity invalidates its entry in `indices`, so if a loop destroys entities it
must not read their storage index afterwards.

## Error Handling

Every operation validates its inputs and throws a descriptive `Error` instead of failing silently or corrupting state:

- `addComponent` / `removeComponent` / `destroyEntity` throw if the entity does not exist
- `addComponent` throws if the entity already has the component; `removeComponent` throws if it doesn't
- `query`, `addComponent` and `removeComponent` throw if the component name was never registered via `defineComponents`
- `defineComponents` throws if a component name is already defined

## ⚖️ License

MIT © 2025 SteTisci
