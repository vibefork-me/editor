import type { TranslationKey } from "../i18n/types.ts";

/** Error codes of a task or a build the editor words itself (the agent's `error` text is English). */
const AGENT_ERRORS: Record<string, TranslationKey> = {
  not_found: "agentErrors.notFound",
  bad_prompt: "agentErrors.badPrompt",
  model_unavailable: "agentErrors.modelUnavailable",
  no_models: "agentErrors.noModels",
  no_model_for_step: "agentErrors.noModelForStep",
  planning_failed: "agentErrors.planningFailed",
  plan_stopped: "agentErrors.planStopped",
  git_failed: "agentErrors.gitFailed",
  task_already_running: "agentErrors.taskAlreadyRunning",
  no_build_recipe: "agentErrors.noBuildRecipe",
  not_enough_resources: "agentErrors.notEnoughResources",
  build_start_failed: "agentErrors.buildStartFailed",
};

/** The phrase for an agent error code; none for an unknown code (an older or newer agent): show its text. */
export function agentErrorKey(code: string | null | undefined): TranslationKey | undefined {
  return code && Object.prototype.hasOwnProperty.call(AGENT_ERRORS, code) ? AGENT_ERRORS[code] : undefined;
}
