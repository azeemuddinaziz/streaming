# Deletion is soft-only and keeps every file

When an owner deletes a Video it disappears for everyone and its link shows "not found", but nothing is removed: the database rows are flagged as deleted, and the original, Renditions and Thumbnails stay in storage. We chose this over hard deletion, or soft deletion with a restore window and later purge, to avoid irreversible data loss during the MVP and to defer the storage-cost problem until it exists and can be solved with real numbers.

## Consequences

- Every read path must exclude deleted rows, since the flag is the only thing hiding them.
- Storage only grows. Reclaiming it later (purging files of deleted Videos) is a deliberate future decision and would supersede this one.
- Deletion is final from the owner's side: there is no restore.
