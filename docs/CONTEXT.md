# Inventaris Aset PPM

QR-based asset inventory for Direktorat PPM, Telkom University. One context: assets, their
custody, loans, and the staff who manage them.

## Language

**Deactivate (user)**:
An admin action that blocks a user from signing in and revokes their sessions, recording a
required reason visible to admins only. Implemented as Better Auth's ban; the product word is
always "deactivate" (id: "Nonaktifkan").
_Avoid_: Ban, suspend, disable

**Reactivate (user)**:
The reverse of deactivation; the stored reason is cleared, with the history preserved in the
activity log.
_Avoid_: Unban

**Deactivate (master data)**:
Marking a category, building, room, or funding source as no longer selectable for new records,
without deleting it. Same word as user deactivation on purpose; context disambiguates.
_Avoid_: Archive, delete
