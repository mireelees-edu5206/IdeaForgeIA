import { apiRequest } from "../../lib/apiClient";
import type { ChatReply, ChatRequest } from "./types";

export const chatApi = {
  sendMessage: (projectId: string, data: ChatRequest) =>
    apiRequest<ChatReply>(`/projects/${projectId}/chat`, { method: "POST", body: data }),
};
