> [!IMPORTANT]  
> Work in progress.

# ECS in TypeScript

A minimalistic game engine with zero dependencies based on the **Entity Component System (ECS)** architecture implemented in **TypeScript**

## Features

- **ECS architecture** with single responsability principles (SRP)

- **SparSet** for ultra-fast entities lookup

- **Structure of Arrays(SoA)** for optimized memory storage and access

- **Bitmask** for efficient component queries

## Core Components

- **EntityManager**: Manage creation, destruction and entity recycle. Uses a bitmask to track components of every entity.

- **ComponentStore**: Generic store that maintains components data in SoA format to maximise cache locality.

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

// Define the structure of components that will be converted in SoA Arrays with the types previously defined
// Position = { x: number[], y: number[] }
// Size = { src: HTMLImageElement[] }
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

## ⚖️ License

MIT © 2025 SteTisci
