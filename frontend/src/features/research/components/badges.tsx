import { Badge } from "../../../components/ui/Badge";
import { CATEGORY_LABELS, RUN_STATUS_META, SOURCE_TYPE_LABELS } from "../constants";
import type { ResearchCategory, RunStatus, SourceType } from "../types";

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { label, className } = RUN_STATUS_META[status];
  return <Badge className={className}>{label}</Badge>;
}

export function CategoryBadge({ category }: { category: ResearchCategory }) {
  return <Badge className="bg-accent-violet/10 text-violet-200 ring-accent-violet/30">{CATEGORY_LABELS[category]}</Badge>;
}

export function SourceTypeBadge({ type }: { type: SourceType }) {
  return <Badge className="bg-slate-400/12 text-slate-300 ring-slate-400/25">{SOURCE_TYPE_LABELS[type]}</Badge>;
}
