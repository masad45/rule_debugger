import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState } from "./components/States";
import { Workspace } from "./components/Workspace.tsx";
import { loadDataset } from "./data/loadData";
import type { Dataset } from "./types";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDataset()
      .then((next) => {
        if (!cancelled) setDataset(next);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load the datasets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (loading) return <LoadingState />;
  if (error || !dataset) {
    return <ErrorState message={error ?? "Could not load the datasets."} onRetry={retry} />;
  }
  return <Workspace dataset={dataset} />;
}
