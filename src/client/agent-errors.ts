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
  start_not_confirmed: "agentErrors.startNotConfirmed",
};

/** Codes of a tool that could not be prepared for a task or a build; each phrase takes `{tool}`. */
const TOOL_ERRORS: Record<string, TranslationKey> = {
  unsupported_platform: "toolErrors.unsupportedPlatform",
  download_failed: "toolErrors.downloadFailed",
  install_failed: "toolErrors.installFailed",
  timed_out: "toolErrors.timedOut",
  cancelled: "toolErrors.cancelled",
  not_allowed: "toolErrors.notAllowed",
};

function known(codes: Record<string, TranslationKey>, code: string | null | undefined): TranslationKey | undefined {
  return code && Object.prototype.hasOwnProperty.call(codes, code) ? codes[code] : undefined;
}

/** The phrase for an agent error code; none for an unknown code (an older or newer agent): show its text. */
export function agentErrorKey(code: string | null | undefined): TranslationKey | undefined {
  return known(AGENT_ERRORS, code);
}

/** The phrase for a tool's error code; none for an unknown code: show the agent's text. */
export function toolErrorKey(code: string | null | undefined): TranslationKey | undefined {
  return known(TOOL_ERRORS, code);
}
