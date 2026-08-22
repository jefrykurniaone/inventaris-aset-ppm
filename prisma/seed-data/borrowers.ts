import type { SeedLoanRole } from "@/lib/seed-asset-mix";

/**
 * Invented borrowers for the five demonstration loans (issue #16). Plausible
 * Indonesian names, no real person — emails use `.invalid`, the domain
 * suffix IANA reserves for exactly this (RFC 2606), so nothing here can ever
 * resolve to a real mailbox.
 */
export interface SeedBorrowerSpec {
  readonly borrowerName: string;
  readonly borrowerEmail: string;
  readonly borrowerUnit: string;
  readonly notes: string | null;
}

export const SEED_BORROWER_BY_ROLE: Readonly<
  Record<SeedLoanRole, SeedBorrowerSpec>
> = {
  overdue: {
    borrowerName: "Budi Santoso",
    borrowerEmail: "budi.santoso@mail.invalid",
    borrowerUnit: "Fakultas Teknik Elektro",
    notes: "Dipinjam untuk praktikum semester berjalan.",
  },
  dueSoon: {
    borrowerName: "Siti Rahmawati",
    borrowerEmail: "siti.rahmawati@mail.invalid",
    borrowerUnit: "Fakultas Informatika",
    notes: null,
  },
  returnedA: {
    borrowerName: "Agus Prasetyo",
    borrowerEmail: "agus.prasetyo@mail.invalid",
    borrowerUnit: "Direktorat PPM",
    notes: "Dikembalikan tepat waktu dalam kondisi baik.",
  },
  returnedB: {
    borrowerName: "Dewi Lestari",
    borrowerEmail: "dewi.lestari@mail.invalid",
    borrowerUnit: "Fakultas Ekonomi dan Bisnis",
    notes: "Dikembalikan terlambat beberapa hari.",
  },
  plainActive: {
    borrowerName: "Rian Hidayat",
    borrowerEmail: "rian.hidayat@mail.invalid",
    borrowerUnit: "Fakultas Rekayasa Industri",
    notes: null,
  },
};
