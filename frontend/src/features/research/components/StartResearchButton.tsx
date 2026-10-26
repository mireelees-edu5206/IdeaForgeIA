import { FiPlay } from "react-icons/fi";

import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { errorMessageFrom } from "../../../lib/formErrors";
import { useStartResearch } from "../queries";
import type { ResearchRun } from "../types";

interface StartResearchButtonProps {
  projectId: string;
  label?: string;
  onStarted?: (run: ResearchRun) => void;
}

export function StartResearchButton({ projectId, label = "Buscar información", onStarted }: StartResearchButtonProps) {
  const start = useStartResearch(projectId);
  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => start.mutate(undefined, { onSuccess: onStarted })}
        loading={start.isPending}
        icon={<FiPlay aria-hidden="true" />}
      >
        {label}
      </Button>
      {start.isError && <Alert>{errorMessageFrom(start.error)}</Alert>}
    </div>
  );
}
