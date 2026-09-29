# migration-data/

Place the legacy exports (one JSON file per entity) here before running `npm run import:data`.

Expected files (one per entity):

- `Herb.json`
- `Remedy.json`
- `Product.json`
- `Event.json`
- `Comment.json`
- `RemedySubmission.json`
- `SellerProfile.json`
- `Wishlist.json`
- `User.json` (optional — imported users are claimed by verified email on
  their first Clerk sign-in, so a missing file is fine if you'd rather let
  users self-sign-up)

`Herb.json` (19 records) and `Remedy.json` (6 records) prepared and cleaned
by the repo owner are already known to the import script: see the
`_migration_note` field on each row for the judgement calls made on them.

The `.gitignore` excludes every `.json` in this folder — the exports are
not committed. Copy them here locally before running the script.
