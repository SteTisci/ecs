import type { ISparseSet } from '../types/ISparseSet.js';

export function SparseSet(): ISparseSet {
  const sparse: number[] = [];
  const dense: number[] = [];
  let size = 0;

  function has(eid: number): boolean {
    const ID = getIndex(eid);

    const exist = ID !== undefined && dense[ID] === eid;
    const isWhitinBounds = ID >= 0 && ID < size;

    return exist && isWhitinBounds;
  }

  function add(eid: number): void {
    if (has(eid)) throw new Error(`ID ${eid} already present in the set`);

    sparse[eid] = size;
    dense[size] = eid;
    size++;
  }

  function remove(eid: number): void {
    if (!has(eid)) throw new Error(`Cannot remove ID ${eid} because does not exists`);

    const ID = getIndex(eid);
    const last = dense[size - 1];

    // Swap with the last element inserted
    dense[ID] = last;
    sparse[last] = ID;

    // Remove the element
    dense.pop();
    size--;
    delete sparse[eid];
  }

  function getIndex(eid: number): number {
    return sparse[eid];
  }

  function getDense(): number[] {
    return dense;
  }

  function getSize(): number {
    return size;
  }

  return { has, add, remove, getIndex, getDense, getSize };
}
