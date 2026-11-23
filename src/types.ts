export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Action = "Alert" | "Review" | "Investigate" | "Block";

export type Rule = {
  rule_id: string;
  name: string;
  description: string;
  action: string;
  severity: string;
};

export type Transaction = {
  transaction_id: string;
  txn_date_time: string;
  sender_account_id: string;
  receiver_account_id: number | null;
  amount: number;
  currency: string;
  transaction_type: string | null;
  terminal_id: number | null;
  merchant_city: string;
  merchant_country: string;
  merchant_postcode: string | number | null;
  merchant_description_condensed: string;
};

export type FeatureVector = {
  transaction_id: string;
  sender_account_id: string;
  receiver_account_id: number | null;
  amount: number;
  currency: string;
  transaction_type: string | null;
  transaction_count: number;
  avg_transaction_amount: number;
  hour_of_day: number;
  day_of_week: number;
  merchant_avg_transaction_amount: number;
};

export type SenderEvent = {
  transactionId: string;
  timeMs: number;
  amount: number;
};

export type SenderProfile = {
  senderAccountId: string;
  total: number;
  typeCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  modalCountry: string;
  events: SenderEvent[];
};

export type EnrichedTransaction = {
  transaction: Transaction;
  feature: FeatureVector;
  sender: SenderProfile;
  timeMs: number;
  searchText: string;
};

export type Dataset = {
  rules: Rule[];
  rows: EnrichedTransaction[];
  byId: Map<string, EnrichedTransaction>;
  currencies: string[];
  types: string[];
  merchants: string[];
  amountsByCurrency: Record<string, number[]>;
  seededHighRisk: string[];
  senderCount: number;
};
