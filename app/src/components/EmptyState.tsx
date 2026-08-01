import { useNavigate } from "react-router-dom";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
}

export function EmptyState({
  title = "暂无本地数据",
  description = "请前往「设置」页下载或导入最新数据包",
  actionLabel = "前往设置",
  actionTo = "/settings",
}: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-2xl text-zinc-400 ring-1 ring-white/10">
        ∅
      </div>
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      <div className="max-w-xs text-center text-xs text-zinc-500">{description}</div>
      <button
        onClick={() => navigate(actionTo)}
        className="mt-1 rounded-lg bg-indigo-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        {actionLabel}
      </button>
    </div>
  );
}
