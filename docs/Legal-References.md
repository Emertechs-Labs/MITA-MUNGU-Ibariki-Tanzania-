## Legal References & Provenance

This file lists authoritative legal sources used by the platform, where local copies exist, and how to verify provenance.

- Title: The Constitution of the United Republic of Tanzania of 1977
  - Canonical source (Office of the Attorney General):
    https://oagmis.oag.go.tz/portal/constitutions/eyJpdiI6Ijd4VVkzN0hYeHRkMkUrU3NhelRYOGc9PSIsInZhbHVlIjoib1p6dTRLK0ZzbDAxQ1hEYXVpSUZ0dz09IiwibWFjIjoiZDBiNzJmOGY3MDg3YTZiM2I4ZTA2NDIyNDZlZjU2ZmQzODkxOTBlY2E1MzQ1NmQyZGM3NGI3MDI4ZDk2MDAwYyJ9
  - Local file copy (snapshot in this repo):
    `docs/Legal URT/THE CONSTITUTION OF THE UNITED REPUBLIC OF TANZANIA  OF 1977.pdf`
  - Recommended verification steps:
    1. Download the canonical PDF from the OAG site.
    2. Compute sha256 on the file and compare to the repo snapshot (store checksums alongside the file when added to the RAG ingestion pipeline).
    3. Record the fetch timestamp and the fetcher DID.

Recommended metadata format (YAML/JSON) for each legal asset
```json
{
  "title": "The Constitution of the United Republic of Tanzania of 1977",
  "source_url": "https://oagmis.oag.go.tz/portal/constitutions/eyJpdiI6Ijd4VVkzN0hYeHRkMkUrU3NhelRYOGc9PSIsInZhbHVlIjoib1p6dTRLK0ZzbDAxQ1hEYXVpSUZ0dz09IiwibWFjIjoiZDBiNzJmOGY3MDg3YTZiM2I4ZTA2NDIyNDZlZjU2ZmQzODkxOTBlY2E1MzQ1NmQyZGM3NGI3MDI4ZDk2MDAwYyJ9",
  "local_path": "docs/Legal URT/THE CONSTITUTION OF THE UNITED REPUBLIC OF TANZANIA  OF 1977.pdf",
  "fetched_at": "2025-10-30T00:00:00Z",
  "sha256": "d27a2826a8d18a55dd87365ad53c97df8b0f1a744ee905180487b339c8cfa1e6",
  "license": "public-domain / government-publication"
}
```

Checksum verification (computed locally)

- File: `docs/Legal URT/THE CONSTITUTION OF THE UNITED REPUBLIC OF TANZANIA  OF 1977.pdf`
- SHA-256: `d27a2826a8d18a55dd87365ad53c97df8b0f1a744ee905180487b339c8cfa1e6`
- Verified at: 2025-10-30 (local compute)

Notes
- The canonical OAG URL is the authoritative source. Keep that link in any UI that cites the Constitution.
- For offline or censorship-resilience, the DAO may choose to pin the PDF to IPFS/Arweave and store the resulting content-addressed identifier in the metadata.
