const TIER_LABEL: Record<number, string> = {
  1: "S",
  2: "A",
  3: "B",
  4: "C",
  5: "D",
};

const TIER_COLOR: Record<number, string> = {
  1: "bg-tier-1/15 text-tier-1 ring-tier-1/30",
  2: "bg-tier-2/15 text-tier-2 ring-tier-2/30",
  3: "bg-tier-3/15 text-tier-3 ring-tier-3/30",
  4: "bg-tier-4/15 text-tier-4 ring-tier-4/30",
  5: "bg-tier-5/15 text-tier-5 ring-tier-5/30",
};

export function TierBadge({ tier, size = "md" }: { tier: number; size?: "sm" | "md" }) {
  const sizeCls = size === "sm" ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold ring-1 ${sizeCls} ${TIER_COLOR[tier] ?? TIER_COLOR[5]}`}
    >
      {TIER_LABEL[tier] ?? "?"}
    </span>
  );
}
