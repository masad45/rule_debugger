# Time report

Estimated time spent building the rule debugger. Figures are rounded to the nearest 5 minutes.

- Reading the brief and the three data files, including the invalid `NaN` tokens, the transaction/feature join, and the currency scales — 25 min
- Project setup (Vite, React, TypeScript, Tailwind) — 15 min
- Loading the data, joining on `transaction_id`, and building sender profiles and currency percentiles — 30 min
- Rule logic and the per-check traces — 45 min
- Rules list, virtualized table, filters, and the step-through inspector — 55 min
- Loading, empty, and error states, and the mobile layout — 25 min
- Checking the flows in the browser and adjusting the layout — 25 min
- README and this report — 10 min

**Total: about 3 hours 50 minutes.**
