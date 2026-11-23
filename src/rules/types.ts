import type { Dataset, EnrichedTransaction } from "../types";

export type ParamValue = number | string | string[];
export type ParamMap = Record<string, ParamValue>;

type Visible = (params: ParamMap) => boolean;

export type ParamSpec =
  | {
      key: string;
      kind: "number";
      label: string;
      min: number;
      max: number;
      step: number;
      hint?: string;
      visible?: Visible;
    }
  | {
      key: string;
      kind: "select";
      label: string;
      options: { value: string; label: string }[];
      hint?: string;
      visible?: Visible;
    }
  | {
      key: string;
      kind: "string-list";
      label: string;
      placeholder: string;
      source: "merchants" | "types";
      hint?: string;
      visible?: Visible;
    };

export type CheckResult = {
  id: string;
  label: string;
  fields: string[];
  passed: boolean;
  detail: string;
};

export type Evaluation = {
  ruleId: string;
  fired: boolean;
  checks: CheckResult[];
  summary: string;
};

export type CheckSpec = {
  id: string;
  label: string;
  fields: string[];
  passed: (row: EnrichedTransaction, params: ParamMap, dataset: Dataset) => boolean;
  detail: (row: EnrichedTransaction, params: ParamMap, dataset: Dataset) => string;
};

export type RuleDefinition = {
  ruleId: string;
  notice?: string | ((dataset: Dataset) => string);
  defaultParams: ParamMap;
  params: ParamSpec[];
  summary: (params: ParamMap) => string;
  successSummary: (row: EnrichedTransaction, params: ParamMap, dataset: Dataset) => string;
  checks: CheckSpec[];
};
