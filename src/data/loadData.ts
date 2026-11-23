import type { FeatureVector, Rule, Transaction } from "../types";
import { buildDataset } from "./profiles";
import type { Dataset } from "../types";

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not reach ${url}.`);
  }
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  const text = await response.text();
  try {
    return JSON.parse(text.replace(/\bNaN\b/g, "null")) as T;
  } catch {
    throw new Error(`Could not parse ${url}.`);
  }
}

export async function loadDataset(): Promise<Dataset> {
  const [rules, transactions, features] = await Promise.all([
    fetchJson<Rule[]>("/data/example_rules.json"),
    fetchJson<Transaction[]>("/data/transactions.json"),
    fetchJson<FeatureVector[]>("/data/feature_vectors.json"),
  ]);
  if (!Array.isArray(rules) || !Array.isArray(transactions) || !Array.isArray(features)) {
    throw new Error("The JSON files did not contain arrays.");
  }
  return buildDataset(rules, transactions, features);
}
