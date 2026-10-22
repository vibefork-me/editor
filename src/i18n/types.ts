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
  canvas: {
    agentHere: string;
    focusHere: string;
    askAbout: string;
    explainProblem: string;
    explainingProblem: string;
    statusUnknown: string;
    statusExploring: string;
    statusChanging: string;
    statusProblem: string;
    statusDone: string;
    doneSummaryTitle: string;
    doneSummarySubtitle: string;
    saveAction: string;
    viewChangesAction: string;
    reconnectingNotice: string;
    emptyCanvasTitle: string;
    emptyCanvasDescription: string;
  };
  viewer: {
    title: string;
    close: string;
    modeFile: string;
    modeDiff: string;
    tooLargeWarning: string;
    loading: string;
    noFileSelected: string;
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
