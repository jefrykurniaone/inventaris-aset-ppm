/**
 * Three demonstration buildings with a realistic set of rooms (issue #16).
 *
 * Codes are chosen not to collide with the local database's existing
 * fixtures: `scripts/seed-e2e-master-data.ts` owns `ETE`, and a developer's
 * own manual testing may already have created others — `ensureBuilding` in
 * `master-data-writer.ts` only ever adds, never assumes an empty table.
 */
export interface SeedRoomSpec {
  readonly code: string;
  readonly name: string;
}

export interface SeedBuildingSpec {
  readonly code: string;
  readonly name: string;
  readonly rooms: readonly SeedRoomSpec[];
}

export const SEED_BUILDINGS: readonly SeedBuildingSpec[] = [
  {
    code: "GKT",
    name: "Gedung Kuliah dan Laboratorium Terpadu",
    rooms: [
      { code: "GKT-101", name: "Laboratorium Elektronika" },
      { code: "GKT-102", name: "Laboratorium Komputer" },
      { code: "GKT-201", name: "Ruang Dosen" },
      { code: "GKT-301", name: "Ruang Server" },
    ],
  },
  {
    code: "GAD",
    name: "Gedung Administrasi Direktorat PPM",
    rooms: [
      { code: "GAD-101", name: "Ruang Tata Usaha" },
      { code: "GAD-102", name: "Ruang Rapat" },
      { code: "GAD-201", name: "Gudang Aset" },
    ],
  },
  {
    code: "GPM",
    name: "Gedung Pengabdian Masyarakat",
    rooms: [
      { code: "GPM-101", name: "Ruang Pelatihan" },
      { code: "GPM-102", name: "Ruang Arsip" },
    ],
  },
];
