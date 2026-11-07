import { queryOptions } from "@tanstack/react-query";
import { listPeds } from "@/lib/peds.functions";
export const pedsQueryOptions = queryOptions({ queryKey: ["peds"], queryFn: () => listPeds(), staleTime: 30_000 });