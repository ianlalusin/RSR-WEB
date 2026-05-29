# Budget & Funding Framework — Design Spec

**Date:** 2026-05-29
**App:** TAPp / RSR Web (congressional office — barangay management + constituent projects)
**Status:** Approved design, pending implementation plan

---

## 1. Goal

Introduce an org-level **Budget & Funding** module that:

1. Tracks money coming in from **configurable funding sources**, in discrete tranches, each with its own **amount** and **status** (`promised → allocated → downloaded`, plus `cancelled / returned / retracted`).
2. **Funds the downstream project sections** (Medical, Educational, Infrastructure) via earmarked allocations, with traceability from spend back to source.
3. Reworks the sidebar so Medical / Educational / Infrastructure live inside a single collapsible **Projects** group, and adds a top-level **Budget** entry.

The fund statuses model the Philippine government fund-download lifecycle, not a flat enum.

---

## 2. Architecture overview

```
FUNDING SOURCES ──> BUDGET LEDGER (fund tranches w/ status) ──> ALLOCATIONS ──> PROJECT SPENDING
  (configurable)      promised→allocated→downloaded            (earmark to        (medical /
                      cancelled/returned/retracted              sector/project)    educational / infra)
```

Two halves: **supply** (Budget) feeds **demand** (Projects). Each half is independently understandable and testable.

Reuses existing codebase conventions:
- Server actions guarded by `assertActor(idToken)` (`src/app/actions.ts`).
- Denormalized `lists/*` lookup docs for dropdowns.
- Pre-computed projection/summary docs for dashboards (like `analytics/*`).
- Status workflows + `auditLogs` discipline.
- `PageKey` + `access.pages` + role presets (`src/lib/access.ts`) + `firestore.rules`.

---

## 3. Data model

### 3.1 Funding Sources (configurable)

`fundingSources/{id}` + denormalized `lists/fundingSources` lookup.

```ts
interface FundingSource {
  id: string;
  name: string;
  category: 'government_agency' | 'congressional_allocation' | 'lgu_counterpart'
          | 'private_donor' | 'ngo_grant' | 'other';
  contactInfo?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Admin/OIC-managed under the Budget section. Satisfies the "different, configurable source" requirement.

### 3.2 Budget Ledger — fund tranches

`budgetEntries/{id}`. **One entry = one tranche of money from one source**, carrying its own amount and current status.

```ts
type BudgetStatus =
  | 'promised' | 'allocated' | 'downloaded'
  | 'cancelled' | 'returned' | 'retracted';

type BudgetSector = 'medical' | 'educational' | 'infrastructure' | 'general';

interface BudgetEntry {
  id: string;
  sourceId: string;
  sourceName: string;            // denormalized for display
  amount: number;
  status: BudgetStatus;          // current status
  sector: BudgetSector;          // earmark; 'general' = unrestricted
  projectId?: string;            // optional tighter earmark to a specific project record
  districtIds?: string[];        // scope, mirrors ProjectRecord
  referenceNo?: string;          // SARO / NCA / check no.
  notes?: string;
  attachments?: string[];
  promisedAt?: Timestamp;
  allocatedAt?: Timestamp;
  downloadedAt?: Timestamp;
  closedAt?: Timestamp;          // set on cancelled/returned/retracted
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 Movement log (audit trail)

Every status transition appends an immutable movement. Subcollection `budgetEntries/{id}/movements/{mid}`:

```ts
interface BudgetMovement {
  id: string;
  from: BudgetStatus | null;     // null on initial create
  to: BudgetStatus;
  amount: number;
  actorUid: string;
  actorEmail: string | null;
  at: Timestamp;
  note?: string;
}
```

Also write an `auditLogs` entry (`entityType: 'budgetEntry'`, `action: 'status_change' | 'create' | 'update'`).

### 3.4 Projection / summary docs

Recomputed on every budget write (server action), so dashboards read one doc:

- `budgetSummary/global`
- `budgetSummary/bySector/{sector}`
- `budgetSummary/bySource/{sourceId}`

```ts
interface BudgetSummary {
  promisedTotal: number;
  allocatedTotal: number;
  downloadedTotal: number;
  returnedTotal: number;
  retractedTotal: number;
  cancelledTotal: number;
  availableTotal: number;        // see balance math §4
  disbursedTotal: number;        // spend drawn by projects
  updatedAt: Timestamp;
}
```

### 3.5 Project linkage

Project-side records (`ProjectRecord`, `MedicalRecord`, future infra/educ records) gain optional:

```ts
fundingEntryId?: string;   // which fund tranche paid for this
fundedSector?: BudgetSector;
```

So each disbursement is traceable to a source.

---

## 4. Status semantics & balance math

| Status | Meaning | Effect on balances |
|---|---|---|
| `promised` | Source committed, not yet earmarked/received | Pipeline only |
| `allocated` | Earmarked to a sector/project | Committed |
| `downloaded` | Cash actually received → spendable | **Adds to Available** |
| `cancelled` | Voided before download | Removed from pipeline |
| `returned` | Downloaded funds sent back (unspent) | **Reduces Available** |
| `retracted` | Source pulled the commitment back | Removed |

**Per-sector available balance:**

```
available(sector) =
    Σ downloaded(sector)
  − Σ returned(sector)
  − Σ retracted-of-downloaded(sector)
  − Σ project disbursements(sector)
```

**Pipeline (committed, not yet cash):**

```
pipeline(sector) = Σ promised(sector) + Σ allocated(sector)
                   (excluding cancelled / retracted)
```

**Allowed status transitions:**

```
(new) ──> promised ──> allocated ──> downloaded ──> returned
            │             │              │
            └─ retracted  └─ cancelled   └─ retracted
promised ──> cancelled
allocated ──> retracted
```

Transitions outside this graph are rejected by the server action.

---

## 5. Over-spend guardrail (DECIDED: soft warning)

When a sector's project disbursements would exceed its `available` balance, the UI **warns** but does not hard-block (configurable later). Rationale: real-world timing gaps between spend and fund download. Prevents the silent over-spend / double-count class of bug while staying flexible.

---

## 6. Funding linkage model (DECIDED: earmarked allocation)

A budget entry is earmarked to a `sector` (or specific `projectId`), or left `general`. Projects draw against their sector's available balance. Chosen over a single general pool because government source funds are usually purpose-restricted, and traceability ("which source paid for which project") is required.

---

## 7. Ledger model (DECIDED: hybrid)

Current `status` field on the entry **+** immutable `movements` log **+** recomputed projection docs. Fits the codebase's existing projection/audit conventions; gives audit trail and double-count protection without full event-sourcing overhead.

---

## 8. Sidebar rework — Projects group + Budget entry

Today's sidebar (`src/components/layout/sidebar.tsx`) renders a flat `navItems` array. Introduce collapsible nav groups.

**Target structure:**

```
Dashboard
Barangays
Receiving
Budget              ← NEW top-level (Overview · Sources · Ledger)
Projects            ← NEW collapsible group
  ├─ Medical
  ├─ Educational
  └─ Infrastructure
Tasker
Analytics
SocMed
Admin (admins only)
```

- `NavItem` gains optional `children?: NavItem[]`.
- A group renders if the user can view **any** child (`item.children.some(c => c.pageKeys.some(canViewPage))`) — no access regression.
- Parent active-state derives from any child route match.
- Existing Medical/Educational/Infra routes and PageKeys are **unchanged** — this is UI grouping only.
- `bottom-nav.tsx` (mobile) updated consistently.

---

## 9. New PageKeys & access

Add to `PageKey`, `ALL_PAGE_KEYS`, every role preset in `access.ts`, and `firestore.rules`:

```
budget_overview
budget_sources
budget_ledger
```

Preset defaults (tunable):
- platformAdmin / oic: `full`
- officeAdmin: `readwrite`
- coordinator: `readonly`
- socmed: `restricted`

`firestore.rules`: budget collections writable by admin/OIC (and officeAdmin per preset), readable per page access. Projection docs (`budgetSummary/*`) are server-written only (no client writes).

---

## 10. New routes

```
/budget            → overview: KPIs (promised, allocated, downloaded, available) by sector & source
/budget/sources    → configure funding sources (CRUD, admin/OIC)
/budget/ledger     → fund entries table + status-transition actions + movement history drawer
```

The Medical "Financial Standing" placeholder (`/medical/financial`) is superseded; it can link into `/budget?sector=medical` (sector-filtered view).

---

## 11. Server actions (in `src/app/actions.ts`, all `assertActor`-guarded)

- `createFundingSource`, `updateFundingSource`, `archiveFundingSource` (+ maintain `lists/fundingSources`)
- `createBudgetEntry` (initial status `promised` or `allocated`)
- `transitionBudgetEntry(entryId, toStatus, note)` — validates against the transition graph, appends movement, writes audit log, recomputes summaries
- `updateBudgetEntry` (editable fields while not closed)
- Project-side: link/unlink `fundingEntryId` on project records; recompute `disbursedTotal`
- `recomputeBudgetSummary(sector?)` — internal projection rebuild

---

## 12. Types to add (`src/lib/types.ts`)

`FundingSource`, `FundingSourceListItem`, `FundingSourceListDoc`, `BudgetStatus`, `BudgetSector`, `BudgetEntry`, `BudgetMovement`, `BudgetSummary`. Extend `AuditLogEntityType` with `'budgetEntry' | 'fundingSource'`.

---

## 13. Out of scope (YAGNI for v1)

- Multi-currency.
- Full double-entry GL / journal postings (this is fund tracking, not a general ledger).
- Approval workflow on budget entries beyond status transitions (can layer later).
- Per-line-item expense receipts inside projects (existing `expenses` concept untouched here).

---

## 14. Build order (informs the implementation plan)

1. Types + access (PageKeys, presets, rules) — foundation, no UI yet.
2. Funding Sources CRUD + `lists/fundingSources`.
3. Budget Ledger entries + transition action + movements + audit.
4. Projection/summary docs + recompute.
5. Budget Overview + Ledger + Sources UI pages.
6. Sidebar groups (Projects group + Budget entry) + bottom-nav.
7. Project-side funding linkage (`fundingEntryId`) + over-spend warning.
