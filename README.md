> [!IMPORTANT]  
> Work in progress.

# ECS in TypeScript

A minimalistic game engine with zero dependencies based on the **Entity Component System (ECS)** architecture implemented in **TypeScript**

## Features

- **ECS architecture** with single responsability principles (SRP)

- **SparSet** for ultra-fast entities lookup

- **Structure of Arrays(SoA)** for optimized memory storage and access — numeric fields are backed by a typed array whose width you can declare per
  field, non-numeric fields by plain arrays

- **Bitmask** for efficient component queries — a multi-word `Int32Array` bitset, so no query operation allocates

## Core Components

- **EntityManager**: Manage creation, destruction and entity recycle. Tracks the components of every entity in a multi-word bitset, one 32-bit word
  per 32 components.

- **ComponentStore**: Generic store that maintains component data in SoA format to maximise cache locality — numeric fields in a growable typed array,
  non-numeric fields (e.g. `HTMLImageElement`) in a plain array.

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
// Numeric fields become a typed array, everything else stays a plain array.
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

## Field storage types

A numeric field with no declared type is stored as `f32`: about 7 significant digits, and consecutive integers stop being exact past 2<sup>24</sup>.
That is fine for a velocity and wrong for a timer that accumulates forever, a world coordinate on a large map, or an entity ID stored inside a
component.

Declare the storage per field with the long form of `defineComponents`:

```typescript
World.defineComponents(
  'Sprite', // short form: every numeric field is f32
  { name: 'Position', schema: { x: 'f64', y: 'f64' } },
  { name: 'Health', schema: { current: 'u16', max: 'u16' } },
  { name: 'Target', schema: { entity: 'i32' } },
);
```

| type                              | array                       | notes                                        |
| --------------------------------- | --------------------------- | -------------------------------------------- |
| `i8` `u8` `i16` `u16` `i32` `u32` | `Int8Array` … `Uint32Array` | exact integers within range, smallest memory |
| `f32`                             | `Float32Array`              | the default, ~7 significant digits           |
| `f64`                             | `Float64Array`              | full JS number precision, twice the memory   |

Only numeric fields can be typed; everything else goes to a plain JS array. A field left out of the schema is still inferred from the first value
written.

Declaring a field also makes it exist before the first `addComponent`, so a system can read `World.components.Position.x` on an empty world instead of
finding `undefined`.

## Pre-allocating: `reserve`

Storage grows by doubling from a small initial capacity. Two reasons to size it up front:

```typescript
World.reserve(100_000);
```

1. It removes the repeated copies of doubling. `addComponent` measurably degrades past a few hundred thousand entities without it.
2. **Growing a numeric field replaces the underlying typed array.** `World.components.X` is a stable object, but `World.components.X.y` is swapped for
   a new buffer when the store grows. Code that caches the field array in a local and then adds components writes into a stale buffer — silently, with
   no error:

```typescript
const x = World.components.Position.x; // cached
World.addComponent(e, 'Position', { x: 1, y: 2 }); // may reallocate
x[0] = 5; // may write to a dead buffer
```

Reserving enough capacity up front keeps a cached reference valid, and re-reading `World.components.X.y` after any batch of `addComponent` calls is
always safe.

## Hot systems: `queryIds` and `queryIdsInto`

`query` yields one result object plus one `{ id }` object per component per entity, which is convenient but allocates on every iteration — roughly
1.8x slower with twice the garbage. For systems that run every frame over many entities, `queryIds` returns the matching entity IDs instead, and
`indices` translates an entity ID into its slot in the SoA arrays:

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

`queryIds` still allocates one array per call, which at 60fps over 100k entities is several megabytes a second. `queryIdsInto` runs the same query
into a buffer the caller owns and keeps alive across frames:

```typescript
const matched: number[] = [];

function movementSystem(World) {
  const { Position, Velocity } = World.components;
  const pos = World.indices.Position;
  const vel = World.indices.Velocity;

  for (const eid of World.queryIdsInto(matched, 'Position', 'Velocity')) {
    Position.x[pos[eid]] += Velocity.x[vel[eid]];
  }
}
```

Over 60 frames on 100k entities that is ~0.04 MB allocated instead of ~10 MB, and about half the wall time. Use `query` for setup, tooling and systems
that touch few entities; use `queryIds` / `queryIdsInto` in anything that runs every frame.

`indices` only holds a meaningful slot for entities that actually have the component — anything else reads as `-1` or `undefined`. Look up entities
the query returned, nothing else.

## Iteration and mutation

`query` iterates a snapshot taken when the generator starts, so calling `removeComponent` or `destroyEntity` from inside the loop cannot skip an
entity. Entities created mid-iteration are not visited by the query in flight; the next call picks them up.

`queryIds` builds its whole result before returning, so the same guarantee holds. Note that destroying an entity invalidates its entry in `indices`,
so if a loop destroys entities it must not read their storage index afterwards.

`queryIdsInto` overwrites its buffer on every call, so do not hold on to a previous result across calls, and do not pass the same buffer to two
queries that are iterated at once.

## Error Handling

Every operation validates its inputs and throws a descriptive `Error` instead of failing silently or corrupting state:

- `addComponent` / `removeComponent` / `destroyEntity` throw if the entity does not exist
- `addComponent` throws if the entity already has the component; `removeComponent` throws if it doesn't
- `query`, `addComponent` and `removeComponent` throw if the component name was never registered via `defineComponents`
- `defineComponents` throws if a component name is already defined

## ⚖️ License

MIT © 2026 SteTisci
