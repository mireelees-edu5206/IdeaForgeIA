import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectsApi } from "./api";
import type { AttributeType, ProjectInput, ProjectListParams } from "./types";

export const projectKeys = {
  all: ["projects"] as const,
  list: (params: ProjectListParams) => [...projectKeys.all, "list", params] as const,
  overview: () => [...projectKeys.all, "overview"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjectList(params: ProjectListParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useProjectsOverview() {
  return useQuery({ queryKey: projectKeys.overview(), queryFn: projectsApi.overview });
}

export function useProject(id: string) {
  return useQuery({ queryKey: projectKeys.detail(id), queryFn: () => projectsApi.get(id) });
}

/** Cualquier cambio invalida listas, resumen y detalle: todo depende de los mismos datos. */
function useProjectMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export const useCreateProject = () => useProjectMutation((data: ProjectInput) => projectsApi.create(data));

export const useUpdateProject = (id: string) =>
  useProjectMutation((data: Partial<ProjectInput>) => projectsApi.update(id, data));

export function useDeleteProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export const useConfirmStructure = (id: string) => useProjectMutation(() => projectsApi.confirmStructure(id));

export const useAddAttribute = (id: string) =>
  useProjectMutation((data: { attribute_type: AttributeType; value: string }) => projectsApi.addAttribute(id, data));

export const useUpdateAttribute = (id: string) =>
  useProjectMutation(({ attributeId, ...data }: { attributeId: string; value?: string; is_confirmed?: boolean }) =>
    projectsApi.updateAttribute(id, attributeId, data),
  );

export const useDeleteAttribute = (id: string) =>
  useProjectMutation((attributeId: string) => projectsApi.deleteAttribute(id, attributeId));
