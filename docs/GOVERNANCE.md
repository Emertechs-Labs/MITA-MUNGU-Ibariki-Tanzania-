## Governance, Constitution Integration & RAG

This document explains how the platform's DAO governance model integrates the Constitution of the United Republic of Tanzania into the platform's RAG (retrieval-augmented generation) knowledge base and how citizens can use that capability to hold officials accountable.

Authoritative Constitution Source
- Primary external canonical URL: https://oagmis.oag.go.tz/portal/constitutions/eyJpdiI6Ijd4VVkzN0hYeHRkMkUrU3NhelRYOGc9PSIsInZhbHVlIjoib1p6dTRLK0ZzbDAxQ1hEYXVpSUZ0dz09IiwibWFjIjoiZDBiNzJmOGY3MDg3YTZiM2I4ZTA2NDIyNDZlZjU2ZmQzODkxOTBlY2E1MzQ1NmQyZGM3NGI3MDI4ZDk2MDAwYyJ9
- Local copy (for offline verification and provenance): `docs/Legal URT/THE CONSTITUTION OF THE UNITED REPUBLIC OF TANZANIA  OF 1977.pdf`

Provenance & Verification
- Always store the following metadata with ingested legal documents:
  - source_url
  - local_path
  - fetched_at (ISO8601)
  - sha256_checksum
  - license / rights

RAG ingestion guidelines (high level)
1. Fetch authoritative file (prefer canonical government URL). If fetching from remote, record fetch metadata and verify checksum.
2. Convert the PDF to structured text with page/section markers. Preserve section headings and article numbers.
3. Chunk text into semantically-aware passages (e.g., by article/section or ~600 token chunks). Add metadata: {source, page, section, start_offset, end_offset}
4. Embed each chunk using Cohere's free API and store in Chroma vector DB with the metadata above.
5. When RAG responds, include a citation header with:
   - section/article number
   - link to canonical source (OAG URL)
   - local copy path and page numbers

### Running the Ingestion Script
To ingest the Constitution into the RAG system:
1. Set env var: `COHERE_API_KEY` (get free API key from Cohere).
2. Run: `npm run ingest:legal`
3. The script uses local Chroma DB for storage, no external API needed for vector DB.

Legal QA & Citizen Interactions
- Citizens can query the platform's RAG assistant to ask "What rights does a citizen have regarding search and seizure?" and get an answer with exact article citations and links to the authoritative text.
- The DAO governs what actions are taken when a user files a complaint against a public official. Complaint flows are implemented as proposals and tracked on-chain until resolution.

Constitutional-level changes
- Any attempt to change DAO core rules that would conflict with constitutional rights requires a two-stage check:
  1. Legal validation (automated RAG + human legal review)
 2. Supermajority DAO vote + public comment period

Access & Transparency
- All RAG indices, ingestion logs, and transformation steps are auditable by the community. Where privacy-sensitive, redaction pipelines run prior to public publication but the provenance metadata remains public.

Data Retention & Censorship Resistance
- Original authoritative sources (government URL + local PDF snapshot) are kept; the RAG system stores only embeddings and references. The DAO may elect to mirror the legal snapshots to decentralized storage (IPFS/Arweave) for long-term immutability.

How citizens can use this
1. Search the Constitution via the platform's legal assistant.
2. Submit evidence-backed proposals referencing specific articles.
3. Use the DAO to request investigations, recall delegates, or propose legal aid funding.
