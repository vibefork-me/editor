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
  pairing: {
    title: string;
    description: string;
    codeLabel: string;
    codeAccessibleLabel: string;
    browserName: string;
    starting: string;
    pending: string;
    denied: string;
    error: string;
    retry: string;
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
    notOriginal: string;
    originalLabel: string;
    takeCode: string;
    importing: string;
    changedFiles: string;
    changesDependencies: string;
    changesBuildScripts: string;
    changesBinaries: string;
    incompleteCheck: string;
    viewChanges: string;
    projectReady: string;
    build: string;
    buildConfirmNote: string;
    building: string;
    buildSucceeded: string;
    buildFailed: string;
    buildCancelled: string;
  };
  project: {
    title: string;
    placeholder: string;
    chatInputLabel: string;
    chatPlaceholder: string;
    sendMessage: string;
    sendingMessage: string;
    taskStarted: string;
    chatStartFailed: string;
    taskDone: string;
    taskFailed: string;
    taskCancelled: string;
    workspaceTabs: string;
    mapTab: string;
    chatTab: string;
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
    statusChanged: string;
    statusUnchanged: string;
    viewToggleAria: string;
    viewParts: string;
    viewFolders: string;
    describingMap: string;
    doneSummaryTitle: string;
    doneSummarySubtitle: string;
    saveAction: string;
    savingAction: string;
    saveComplete: string;
    saveUnchanged: string;
    saveNextStep: string;
    saveFollowup: string;
    saveError: string;
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
    binaryWarning: string;
    forbiddenWarning: string;
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
