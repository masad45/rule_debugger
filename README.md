# Rule debugger

A small operations console for the Features Now take-home. It loads the three JSON files, joins each transaction to its feature vector, and shows why each fraud rule fires or stays silent.

## Run

Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://127.0.0.1:5173). `pnpm install` works as well. `npm run build` typechecks and writes a production bundle to `dist/`.

The app reads the JSON from `public/data/`, which links to the files in the project root. Those files are not valid JSON: `NaN` is used for missing postcodes, 616 transaction types, and 13 receiver ids. The loader replaces `NaN` with `null` before parsing. The original files are left unchanged.

## Approach

The rules file describes seven rules and does not include thresholds or predicates. The console turns each description into an explicit AND of checks. Every check records pass or fail, the value it read, and the threshold it used. Changing a parameter recomputes the fired count immediately.

Pick a rule, then a transaction. The inspector steps through that rule one check at a time (buttons, or the left and right arrow keys). The active check highlights the transaction and feature fields it used. The same panel lists every other rule on that transaction, so you can switch the trace without losing the row.

Transactions and feature vectors are joined on `transaction_id` (38,903 rows, a perfect overlap). Sender history — type mix, usual country, and a time-ordered list of payments — is built once and shared by the rules that need it.

## Technology

- Vite, React, and TypeScript
- Tailwind CSS
- `@tanstack/react-virtual` for the 39k-row table

Rule logic lives in `src/rules/definitions.ts`. The UI only displays what that module returns. To change a rule during a review, edit the checks or the default parameters there, or use the parameter controls on the rule itself.

## Design

The screen is a three-pane console: rules on the left, the match table in the center, and the trace on the right. Severity and action are filters on the rule list, which also searches name, description, and id. The transaction view is the same table with type, currency, and amount-range filters, plus the feature columns (`transaction_count`, both averages, hour, and day).

Amounts are not on one scale. A typical PAB payment is about 13 and a typical COP payment is about 58,000, so a single cutoff would flag almost every COP row and almost no PAB row. High-value and “significant amount” checks default to a percentile of that currency. The trace prints the actual cutoff.

On a narrow screen the rule list becomes a horizontal strip, rows become cards, and the trace opens as a full-screen sheet. Loading, empty, and failed-fetch states are separate screens.

## How each rule decides

Day 0 in the feature file is Monday (`2024-09-30`). There is no timezone, so `hour_of_day` is used as given.

- **RULE_001 High value.** Amount is at or above that currency’s 95th percentile. Switch the control to one absolute amount if you want to see how a shared cutoff behaves.
- **RULE_002 Many small payments.** Amount is at or below 50 (not converted between currencies) and the sender has at least 5 such payments in the previous 60 minutes. `transaction_count` is the sender’s running total, not that window, and the trace says so.
- **RULE_003 Unusual type.** The type is present, the sender has at least 20 payments, and this type is under 10% of their history. A null type is shown as unknown and does not fire the rule.
- **RULE_004 High-risk merchant.** Nothing in the files marks a merchant as high risk. The rule fires only when the condensed merchant name is on an editable list. The list starts with the five highest-average names that have at least 10 payments. Those averages mix currencies, so the seed is a stand-in, not a risk score.
- **RULE_005 Cross-border.** The merchant country is not the sender’s most common country, and the amount is at or above that currency’s 90th percentile.
- **RULE_006 Outside hours.** The hour is before 08:00 or at/after 20:00. The end hour is not included.
- **RULE_007 Large cash withdrawal.** The type has to be `atm`, `cash`, or `withdrawal`, and the amount has to clear that currency’s 95th percentile. The file only contains online, contactless, chip and pin, refund, internal, and unknown, so the rule matches nothing until the type list includes a type that exists. Open any row to see the type check fail.

## Project layout

- `src/data/loadData.ts` loads and sanitizes the JSON
- `src/data/profiles.ts` joins the files and builds sender profiles and currency percentiles
- `src/rules/definitions.ts` is the rule logic and the default parameters
- `src/rules/evaluate.ts` runs the checks and builds the trace
- `src/components/` is the shell, table, filters, and inspector
