import { useEffect, useState, useCallback, useMemo } from "react";

/**
 * Generic hook for fetching data from an API endpoint
 * Handles loading, error states, and automatic refetch
 */
export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize deps to avoid infinite re-renders
  const depsKey = useMemo(() => JSON.stringify(deps), [deps]);

  useEffect(() => {
    const fetchData = async () => {
      if (!url) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [url, depsKey]);

  const refetch = useCallback(async () => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook for fetching paginated data from an API endpoint
 */
export function usePaginatedFetch<T>(
  url: string | null,
  filters: Record<string, string | number> = {},
) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).map(([k, v]) => [k, String(v)]),
        ),
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await response.json();

      // Handle both direct arrays and paginated responses
      if (Array.isArray(result)) {
        setData(result);
      } else if (
        result.data ||
        result.logs ||
        result.rules ||
        result.templates
      ) {
        // Handle different paginated response formats
        const dataKey = Object.keys(result).find((k) =>
          Array.isArray(result[k]),
        );
        if (dataKey) {
          setData(result[dataKey]);
          if (result.pagination) {
            setPagination(result.pagination);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [url, pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  return { data, pagination, isLoading, error, refetch: fetchData, setPage };
}
