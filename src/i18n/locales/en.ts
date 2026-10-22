import type { TranslationSchema } from "../types.ts";

export const en: TranslationSchema = {
  common: {
    appTitle: "Vibefork editor",
    backToHome: "Back to home",
    copy: "Copy",
    copied: "Copied",
    example: "Example:",
  },
  agentOffline: {
    notRunningTitle: "Vibefork Agent is not running on your computer",
    notRunningDescription: "Start the local agent or install it with a single command in PowerShell.",
    openAgent: "Open agent",
    installHeader: "Installation (PowerShell)",
    copyFailedHint: "Select the command and copy manually.",
    networkBlockedTitle: "Browser restricted local network access",
    networkBlockedDescription:
      "To connect the editor to the local agent, allow access to local network devices for site {domain}.",
    chromeEdgeTitle: "Google Chrome or Microsoft Edge",
    chromeEdgeInstructions:
      "Open the lock/settings icon on the left of the address bar → Site permissions → Local network → Allow. No page reload needed — connection will be verified automatically.",
    firefoxTitle: "Mozilla Firefox",
    firefoxInstructions:
      "Click the 'i' icon in the address bar → Permissions → find Local Network access and choose Allow for this site.",
  },
  mobileUnsupported: {
    title: "Windows PC required",
    description: "The web IDE is designed for computers running Windows.",
  },
  security: {
    warningTitle: "Security warning: external web origins enabled (extraOrigins)",
    currentOriginAllowed: "Current origin is allowed",
    description:
      "The Vibefork agent is configured with additional trusted origins: {origins}. Any web page hosted on these origins has access to your local agent and project files.",
    detailsSecurityTitle: "Security:",
    detailsSecurityText:
      "The extraOrigins mode is intended solely for local development (e.g. Vite dev server on localhost:5173).",
    detailsDisableText:
      "To disable, remove the extraOrigins field from settings.json or unset the VF_EXTRA_ORIGINS environment variable and restart the agent.",
    showRiskDetails: "Details on risks",
    hideRiskDetails: "Hide details",
    dismissTitle: "Dismiss warning",
    compactNotice: "External origins allowed ({count}): {origins}",
    showWarning: "Show warning",
  },
  home: {
    chooseProject: "Choose a project",
    onboardingPlaceholder: "Onboarding and project list will live here.",
  },
  open: {
    title: "Open from the site",
    missingRepo: "Missing repo query parameter",
    refLabel: "ref:",
    pathLabel: "path:",
    workflowNotice: "Lookup, clone, and navigation to /{projectId} will run here.",
  },
  project: {
    title: "Project shell",
    placeholder: "Canvas, chat, and phase rail will mount here.",
  },
  language: {
    ru: "Русский",
    en: "English",
    selectLanguage: "Switch language",
  },
};
