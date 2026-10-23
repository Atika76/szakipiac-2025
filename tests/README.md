# PRO+ regression tests

Node.js 24: run `node --test tests/*.test.cjs` from the repository root.
All helpers, catalog baselines and the verification workflow are included in Git.
No npm installation is required for these Node tests.

`.github/workflows/verify-workflow.yml` runs Node tests and two isolated PostgreSQL
17 jobs (baseline schema and captured hosted-schema fixture). Neither job has
production credentials or deployment steps. SQL runners refuse remote hosts and
any database name other than `issue8_test`.

The SQL order is postgres-integration, building-postgres, building-share-postgres,
components-postgres, resources-postgres, quickquote-postgres, order-rules-postgres,
quote-archive-postgres. The hosted-schema job additionally checks historical
permission proposals and performs a full **synthetic** database backup/restore.
The permission SQL under fixtures is historical test input, not an instruction
to change production privileges. Captured schema fixtures contain no business rows.

Browser/PDF scripts require an existing Playwright/browser runtime. Their results
must be reported separately from Node and PostgreSQL checks. The two-stack
supabase-e2e runner requires its explicitly isolated CI environment and peer repo;
it is not automatically run by this single-repository workflow.
