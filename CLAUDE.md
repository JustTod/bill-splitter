# Bill Splitter — Claude Code Context

Drop this file into `~/Desktop/playground/bill-splitter/` and tell Claude Code:
> "Read CLAUDE.md and implement the bill splitter app described inside."

---

## What this app does

A mobile-friendly bill splitter web app. Users enter food/drink items, optional service charge and VAT, a list of people, and the app calculates how much each person owes.

---

## Sections (in order, displayed top to bottom)

### 01 · Charges
Two optional toggles:
- **Service Charge** — checkbox + editable %, default 10%
- **VAT** — checkbox + editable %, default 7%

Both are off by default. When enabled, they apply to every item.

### 02 · Items
A table where each row is one menu item. Users can keep adding rows.

**Input fields per row (user types these):**
| Field | Type | Notes |
|---|---|---|
| Item name | text | |
| Unit price | number | price per unit |
| Quantity | number | default 1 |

**Auto-calculated per row (read-only display):**
| Field | Formula |
|---|---|
| Subtotal | `unitPrice × quantity` |
| Service charge amt | `subtotal × scPct` (hidden if SC off) |
| VAT amt | `(subtotal + scAmt) × vatPct` (hidden if VAT off) |
| Grand total | `subtotal + scAmt + vatAmt` |

Below the table: a running **totals bar** (Subtotal / Service / VAT / Grand Total).

### 03 · People
User adds people with editable name chips. Default name "Person N".
- Add button adds a new person
- Each chip has a remove (✕) button

### 04 · Who shares what?
A matrix table:
- Rows = items
- Columns = people
- Each cell = checkbox (checked by default = this person shares this item)
- **If nobody is checked for an item → split evenly among ALL people**

### 05 · Split Summary
Result cards, one per person showing their final amount owed.

Each card also has an optional **"Fixed pay"** input:
- If a person fills in a fixed amount (e.g. 1000 THB), they pay exactly that
- Their fixed amount is subtracted from the grand total
- The remaining balance is split among everyone else proportionally (based on their natural share ratio)
- If the fixed amount is more than their fair share, the surplus still reduces others' amounts
- Card shows "fixed · fair share: X" as a hint when fixed pay is active

A "Bill Total" summary card shows grand total and total collected.

---

## Calculation Logic

### Per-item calculation
```
subtotal = unitPrice × quantity
scAmt    = subtotal × (scPct / 100)          // 0 if SC disabled
vatAmt   = (subtotal + scAmt) × (vatPct / 100) // 0 if VAT disabled
grand    = subtotal + scAmt + vatAmt
// All values rounded to 2 decimal places
```

### Split calculation (calcSplit)

**Step 1 — Natural share per person**
For each item, look at who has their checkbox checked.
- If ≥1 person checked → only those people share that item
- If 0 people checked → all people share that item evenly

Split item grand total among sharers. Handle rounding: last person gets `grand - sum_of_others`.

**Step 2 — Fixed vs floating persons**
- **Fixed**: person has entered a fixed pay amount
- **Floating**: everyone else

**Step 3 — Remaining after fixed contributions**
```
totalFixed = sum of all fixed pay amounts
remaining  = grandTotal - totalFixed
```

**Step 4 — Split remaining among floating persons proportionally**
```
floatingNaturalTotal = sum of natural shares of floating persons
each floating person's share = remaining × (theirNaturalShare / floatingNaturalTotal)
```
Last floating person gets `remaining - sum_of_others` (rounding fix).

---

## Key UX Requirements

- **Mobile-first** — works well on small screens, horizontal scroll on tables
- **No focus loss on typing** — never replace input DOM nodes while the user is typing. Only update computed/display cells surgically when a value changes. Full re-render only when rows/columns are added or removed.
- **Live updates** — all calculations update instantly on every change
- All money values display with **2 decimal places**

---

## State shape (as TypeScript types for reference)

```ts
type Item = {
  id: number
  name: string
  unitPrice: number
  qty: number
}

type Person = {
  id: number
  name: string
}

// sharing[itemId][personId] = true means that person shares that item
type Sharing = Record<number, Record<number, boolean>>

// fixedPay[personId] = number | null
// null means "floating" (calculated normally)
type FixedPay = Record<number, number | null>

type AppState = {
  items: Item[]
  persons: Person[]
  sharing: Sharing
  fixedPay: FixedPay
  scEnabled: boolean
  scPct: number       // default 10
  vatEnabled: boolean
  vatPct: number      // default 7
}
```

---

## Design / Theme

Dark theme with these color tokens (implement as Tailwind config or CSS variables):

| Token | Value | Usage |
|---|---|---|
| bg | `#0f0f11` | page background |
| surface | `#1a1a1f` | cards, sections |
| surface2 | `#22222a` | table headers, inputs |
| border | `#2e2e3a` | all borders |
| accent | `#f0e040` | yellow — primary highlights, focused inputs |
| accent2 | `#40e0c0` | teal — people, fixed pay |
| danger | `#ff5566` | delete buttons |
| text | `#f0eff5` | primary text |
| muted | `#7a7a8e` | labels, placeholders |

Fonts: `Syne` (headings/UI) + `DM Mono` (numbers) from Google Fonts.

---

## Suggested Next.js component structure

```
app/
  page.tsx               ← main page, renders <BillSplitter />
  layout.tsx             ← font imports, dark bg

components/
  BillSplitter.tsx       ← root, holds all state (useReducer or useState)
  ChargesSection.tsx     ← SC / VAT toggles
  ItemsTable.tsx         ← items table + add row button + totals bar
  ItemRow.tsx            ← single item row (inputs + computed cells)
  PeopleSection.tsx      ← person chips + add person button
  SharingMatrix.tsx      ← who-shares-what checkbox table
  SplitSummary.tsx       ← result cards with fixed pay inputs

lib/
  calc.ts                ← pure calculation functions (calcItem, calcSplit, round2)
  types.ts               ← shared TypeScript types
```

Keep all state at the `BillSplitter` level and pass down via props + callbacks. Use `useReducer` if state gets complex.

**Critical**: `ItemRow` must NOT re-mount when values change — use controlled inputs with `onChange` and update only computed display values, never replace the input element itself.

---

## Example from real usage (no VAT scenario)

| Item | Unit Price | Qty | Subtotal | SC (+10%) | Grand |
|---|---|---|---|---|---|
| Spaghetti | 155 | 1 | 155 | 15.50 | 170.50 |
| Boat Noodle | 85 | 6 | 510 | 51.00 | 561.00 |
| Boat Kao Lao | 95 | 1 | 95 | 9.50 | 104.50 |
| Thai tea | 85 | 1 | 85 | 8.50 | 93.50 |
| Water | 20 | 4 | 80 | 8.00 | 88.00 |

People: Tod, Aerb, Man, Joy, Natt, Tor, Nuch, Hein (8 people)

Joy only shared Spaghetti. Natt only shared Boat Kao Lao. Nuch shared Thai tea and Spaghetti. Water shared by everyone except Nuch.

Expected totals per person ≈ 106.07 each for most, with exceptions for Joy (183.07) and Nuch (187.00).
