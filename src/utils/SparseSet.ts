import type { ISparseSet } from '../types/ISparseSet.js';

// Marks an entity ID that is not in the set. Using a tombstone instead of
// `delete sparse[eid]` keeps `sparse` in V8's fast packed-elements representation:
// a single `delete` transitions the array to dictionary mode, which is a permanent
// ~35x cost on every later access (3.53 ms vs 0.10 ms over 100k operations).
const EMPTY = -1;

// How far ahead of the table `add` will pave with tombstones rather than leave a hole.
//
// Writing far past the end of an array makes V8 give up on packed elements and switch to a
// dictionary, which costs ~5x on every later lookup. Paving the gap avoids that, but paving
// unconditionally would make every store span the whole entity ID range: a component held
// by 2.000 of 200.000 entities measured 2.00 MB paved against 0.13 MB left holey. Sizing
// each store by the entities that actually hold it is the reason this ECS beats an
// eid-indexed layout on rare components, so the paving stops where it stops paying.
//
// Gaps this small come from entities created in a batch and given their components right
// away — the normal case, where the gap is usually zero.
const MAX_PAVED_GAP = 32;

export function SparseSet(): ISparseSet {
  const sparse: number[] = [];
  const dense: number[] = [];
  let size = 0;

  function has(eid: number): boolean {
    const ID = sparse[eid];

    // `undefined` for an ID past the end of the table, or inside a gap that `add` chose
    // not to pave. Both mean absent, same as an explicit tombstone.
    if (ID === undefined || ID === EMPTY) return false;

    return ID >= 0 && ID < size && dense[ID] === eid;
  }

  function add(eid: number): void {
    if (has(eid)) throw new Error(`ID ${eid} already present in the set`);

    // Pave a short gap with tombstones rather than letting the assignment punch a hole,
    // for the same reason `remove` does not use `delete`. A long gap is left alone: see
    // MAX_PAVED_GAP.
    if (eid - sparse.length <= MAX_PAVED_GAP) {
      for (let i = sparse.length; i < eid; i++) sparse[i] = EMPTY;
    }

    sparse[eid] = size;
    dense[size] = eid;
    size++;
  }

  function remove(eid: number): void {
    if (!has(eid)) throw new Error(`Cannot remove ID ${eid} because does not exists`);

    const ID = sparse[eid];
    const last = dense[size - 1];

    // Swap with the last element inserted
    dense[ID] = last;
    sparse[last] = ID;

    // Remove the element. The tombstone is written after the swap so that removing the
    // last element (where `last === eid`) still ends up marked as absent.
    dense.pop();
    size--;
    sparse[eid] = EMPTY;
  }

  function getIndex(eid: number): number {
    const ID = sparse[eid];
    return ID === undefined ? EMPTY : ID;
  }

  function getDense(): number[] {
    return dense;
  }

  function getSize(): number {
    return size;
  }

  // Exposes the raw lookup table so hot loops can index it directly instead of
  // paying a closure call to getIndex() for every entity.
  function getSparse(): number[] {
    return sparse;
  }

  return { has, add, remove, getIndex, getDense, getSize, getSparse };
}
