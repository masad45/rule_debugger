import { parseTxnTime } from "../format";
import type { Dataset, EnrichedTransaction, FeatureVector, Rule, SenderProfile, Transaction } from "../types";

type Pair = {
  transaction: Transaction;
  feature: FeatureVector;
  timeMs: number;
};

export function buildDataset(rules: Rule[], transactions: Transaction[], features: FeatureVector[]): Dataset {
  if (transactions.length !== features.length) {
    throw new Error(
      `Expected a feature vector for every transaction, found ${transactions.length.toLocaleString()} transactions and ${features.length.toLocaleString()} feature vectors.`,
    );
  }

  const featureById = new Map(features.map((feature) => [feature.transaction_id, feature]));
  const pairs: Pair[] = transactions.map((transaction) => {
    const feature = featureById.get(transaction.transaction_id);
    if (!feature) throw new Error(`No feature vector for ${transaction.transaction_id}.`);
    return { transaction, feature, timeMs: parseTxnTime(transaction.txn_date_time) };
  });

  const grouped = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const senderId = pair.transaction.sender_account_id;
    const list = grouped.get(senderId);
    if (list) list.push(pair);
    else grouped.set(senderId, [pair]);
  }

  const profiles = new Map<string, SenderProfile>();
  for (const [senderAccountId, items] of grouped) {
    const typeCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    for (const item of items) {
      const type = item.transaction.transaction_type ?? "unknown";
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      const country = item.transaction.merchant_country || "unknown";
      countryCounts[country] = (countryCounts[country] ?? 0) + 1;
    }
    let modalCountry = "";
    let modalCount = -1;
    for (const [country, count] of Object.entries(countryCounts)) {
      if (count > modalCount || (count === modalCount && country.localeCompare(modalCountry) < 0)) {
        modalCountry = country;
        modalCount = count;
      }
    }
    const events = items
      .map((item) => ({
        transactionId: item.transaction.transaction_id,
        timeMs: item.timeMs,
        amount: item.transaction.amount,
      }))
      .sort((a, b) => a.timeMs - b.timeMs || a.transactionId.localeCompare(b.transactionId));
    profiles.set(senderAccountId, {
      senderAccountId,
      total: items.length,
      typeCounts,
      countryCounts,
      modalCountry,
      events,
    });
  }

  const rows: EnrichedTransaction[] = pairs.map((pair) => {
    const sender = profiles.get(pair.transaction.sender_account_id);
    if (!sender) throw new Error(`No sender profile for ${pair.transaction.sender_account_id}.`);
    return {
      transaction: pair.transaction,
      feature: pair.feature,
      sender,
      timeMs: pair.timeMs,
      searchText: [
        pair.transaction.transaction_id,
        pair.transaction.sender_account_id,
        pair.transaction.merchant_description_condensed,
        pair.transaction.merchant_city,
        pair.transaction.merchant_country,
        pair.transaction.currency,
        pair.transaction.transaction_type ?? "unknown",
      ]
        .join(" ")
        .toLowerCase(),
    };
  });

  const amountsByCurrency: Record<string, number[]> = {};
  const merchantStats = new Map<string, { sum: number; count: number }>();
  const typeSet = new Set<string>();
  const currencySet = new Set<string>();
  const merchantSet = new Set<string>();

  for (const row of rows) {
    const currency = row.transaction.currency;
    const amounts = amountsByCurrency[currency] ?? (amountsByCurrency[currency] = []);
    amounts.push(row.transaction.amount);
    const name = row.transaction.merchant_description_condensed;
    const stat = merchantStats.get(name) ?? { sum: 0, count: 0 };
    stat.sum += row.transaction.amount;
    stat.count += 1;
    merchantStats.set(name, stat);
    typeSet.add(row.transaction.transaction_type ?? "unknown");
    currencySet.add(currency);
    merchantSet.add(name);
  }

  for (const amounts of Object.values(amountsByCurrency)) amounts.sort((a, b) => a - b);

  const seededHighRisk = [...merchantStats.entries()]
    .filter(([, stat]) => stat.count >= 10)
    .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name]) => name);

  const types = [...typeSet].sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a.localeCompare(b);
  });

  return {
    rules,
    rows,
    byId: new Map(rows.map((row) => [row.transaction.transaction_id, row])),
    currencies: [...currencySet].sort((a, b) => a.localeCompare(b)),
    types,
    merchants: [...merchantSet].sort((a, b) => a.localeCompare(b)),
    amountsByCurrency,
    seededHighRisk,
    senderCount: profiles.size,
  };
}
