export type Locale = "ru" | "en";

export type Primitive = string | number;

export type TranslationParams = Record<string, Primitive>;

export interface TranslationSchema {
  common: {
    appTitle: string;
    backToHome: string;
    copy: string;
    copied: string;
    example: string;
  };
  agentOffline: {
    notRunningTitle: string;
    notRunningDescription: string;
    openAgent: string;
    installHeader: string;
    copyFailedHint: string;
    networkBlockedTitle: string;
    networkBlockedDescription: string;
    chromeEdgeTitle: string;
    chromeEdgeInstructions: string;
    firefoxTitle: string;
    firefoxInstructions: string;
  };
  mobileUnsupported: {
    title: string;
    description: string;
  };
  security: {
    warningTitle: string;
    currentOriginAllowed: string;
    description: string;
    detailsSecurityTitle: string;
    detailsSecurityText: string;
    detailsDisableText: string;
    showRiskDetails: string;
    hideRiskDetails: string;
    dismissTitle: string;
    compactNotice: string;
    showWarning: string;
  };
  home: {
    chooseProject: string;
    onboardingPlaceholder: string;
  };
  open: {
    title: string;
    missingRepo: string;
    refLabel: string;
    pathLabel: string;
    workflowNotice: string;
  };
  project: {
    title: string;
    placeholder: string;
  };
  language: {
    ru: string;
    en: string;
    selectLanguage: string;
  };
}

export type TranslationKey = {
  [K in keyof TranslationSchema]: `${K & string}.${keyof TranslationSchema[K] & string}`;
}[keyof TranslationSchema];
