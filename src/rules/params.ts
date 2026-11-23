import type { ParamMap } from "./types";

export function num(params: ParamMap, key: string): number {
  const value = params[key];
  return typeof value === "number" ? value : Number(value);
}

export function str(params: ParamMap, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export function list(params: ParamMap, key: string): string[] {
  const value = params[key];
  return Array.isArray(value) ? value : [];
}
