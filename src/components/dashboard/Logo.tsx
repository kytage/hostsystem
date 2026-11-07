import { cn } from "@/lib/utils";

/** HOST mark — vector version of the official logo (1966×1866 artboard). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1966 1866" className={cn("h-6 w-auto", className)} fill="#ce0e0e" aria-label="HOST" role="img">
      <path d="M0 0 L600 272 Q614 279 614 295 L614 665 Q614 682 596 687 L22 826 Q0 828 0 804 Z" />
      <path d="M1966 0 L1966 806 Q1966 825 1946 830 L632 1146 Q614 1151 614 1168 L614 1584 L0 1866 L0 1043 Q0 1026 16 1021 L1332 700 Q1351 695 1351 677 L1351 295 Q1351 279 1366 272 Z" />
      <path d="M1966 1866 L1351 1584 L1351 1235 Q1353 1217 1369 1212 L1940 1072 Q1965 1070 1965 1094 Z" />
    </svg>
  );
}
