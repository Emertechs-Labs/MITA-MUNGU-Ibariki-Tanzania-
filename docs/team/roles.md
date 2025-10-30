# Roles & Responsibilities

This document outlines suggested roles needed for a successful short-term rollout and ongoing operations of the MITA DAO Platform.

1. Project Lead / Product Owner
   - Primary contact for product decisions and priorities.
   - Accepts deployments to production and prioritizes bugs/features.
   - Coordinates with stakeholders and regional partners.

2. Engineering Lead
   - Oversees the codebase, architecture, and major merges.
   - Responsible for release coordination and rollbacks.
   - Reviews and approves PRs for production changes.

3. DevOps / CI-CD Engineer
   - Manages Vercel, GitHub Actions, and infrastructure automation.
   - Maintains `vercel.json`, `.vercelignore`, and deployment pipelines.
   - Responds to build/deploy failures and implements hotfixes.

4. Frontend Engineer
   - Maintains the React application in `frontend/`.
   - Ensures builds succeed and UI regressions are addressed.

5. Backend Engineer
   - Manages backend services (Hedera integrations, APIs) in `src/server`.
   - Ensures API stability for frontend consumption.

6. QA / Tester
   - Runs smoke tests against preview and production deployments.
   - Validates critical flows (login, voting, identity flows).

7. Security & Compliance
   - Reviews dependency vulnerabilities and security configurations.
   - Ensures environment secrets handling and access control.

8. Support / On-call
   - First responder for incidents; follows runbook and escalation procedures.

9. Documentation / Operations
   - Keeps `docs/` up to date including deployment runbooks, rollback steps, and runbooks for on-call.


Short Run Priorities
- Assign a DevOps engineer and a Frontend engineer first to address the Vercel CI/CD build issues.
- The Project Lead and Engineering Lead should be decision-makers for enabling public deployments.


Contact & Escalation
- For build/deploy failures: DevOps -> Engineering Lead -> Project Lead
- For security incidents: Security -> Engineering Lead -> Project Lead

