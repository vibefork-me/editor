import type { TranslationSchema } from "../types.ts";

export const ru: TranslationSchema = {
  common: {
    appTitle: "Vibefork editor",
    backToHome: "На главную",
    copy: "Копировать",
    copied: "Скопировано",
    example: "Пример:",
  },
  agentOffline: {
    notRunningTitle: "Vibefork Agent не запущен на вашем компьютере",
    notRunningDescription: "Запустите локальный агент или установите его одной командой в PowerShell.",
    openAgent: "Открыть агент",
    installHeader: "Установка (PowerShell)",
    copyFailedHint: "Выделите команду и скопируйте вручную.",
    networkBlockedTitle: "Браузер ограничил доступ к локальной сети",
    networkBlockedDescription:
      "Чтобы редактор подключился к агенту на этом компьютере, разрешите доступ к устройствам в локальной сети для сайта {domain}.",
    chromeEdgeTitle: "Google Chrome или Microsoft Edge",
    chromeEdgeInstructions:
      "Откройте значок замка слева от адресной строки → «Разрешения для сайта» → «Локальная сеть» → «Разрешить». Обновление страницы не требуется — подключение проверится автоматически.",
    firefoxTitle: "Mozilla Firefox",
    firefoxInstructions:
      "Нажмите значок «i» в адресной строке → «Разрешения» → найдите доступ к локальной сети (Local Network) и выберите «Разрешить» для этого сайта.",
  },
  mobileUnsupported: {
    title: "Нужен компьютер с Windows",
    description: "Веб-IDE предназначена для компьютеров под управлением Windows.",
  },
  security: {
    warningTitle: "Предупреждение безопасности: активны сторонние веб-источники (extraOrigins)",
    currentOriginAllowed: "Текущий адрес разрешён",
    description:
      "Агент Vibefork настроен с дополнительными доверенными адресами: {origins}. Любая веб-страница на этих адресах получает доступ к локальному агенту и вашим проектам.",
    detailsSecurityTitle: "Безопасность:",
    detailsSecurityText:
      "Режим extraOrigins предназначен только для локальной разработки (например, Vite dev-сервера на localhost:5173).",
    detailsDisableText:
      "Чтобы отключить, удалите поле extraOrigins из settings.json или очистите переменную окружения VF_EXTRA_ORIGINS и перезапустите агент.",
    showRiskDetails: "Подробнее о риске",
    hideRiskDetails: "Скрыть подробности",
    dismissTitle: "Скрыть предупреждение",
    compactNotice: "Разрешены сторонние источники ({count}): {origins}",
    showWarning: "Показать предупреждение",
  },
  home: {
    chooseProject: "Выберите проект",
    onboardingPlaceholder: "Здесь появится список проектов и онбординг.",
  },
  open: {
    title: "Открыть с сайта",
    missingRepo: "Не указан параметр запроса repo",
    refLabel: "ветка / коммит:",
    pathLabel: "путь:",
    workflowNotice: "Здесь будет выполняться поиск, клонирование и переход в /{projectId}.",
  },
  project: {
    title: "Оболочка проекта",
    placeholder: "Здесь разместятся канвас, чат и фазовый трек.",
  },
  canvas: {
    agentHere: "сейчас здесь",
    focusHere: "Направить сюда",
    askAbout: "Спросить об этом",
    explainProblem: "Объяснить проблему",
    explainingProblem: "Получение объяснения...",
    statusUnknown: "Не исследовано",
    statusExploring: "Исследование",
    statusChanging: "Внесение правок",
    statusProblem: "Проблема",
    statusDone: "Готово",
    doneSummaryTitle: "Задача завершена",
    doneSummarySubtitle: "Все модули проверены и готовы к сохранению.",
    saveAction: "Сохранить",
    viewChangesAction: "Посмотреть изменения",
    reconnectingNotice: "Переподключение к агенту...",
    emptyCanvasTitle: "Карта проекта строится",
    emptyCanvasDescription: "Агент исследует проект и построит граф модулей в реальном времени.",
  },
  viewer: {
    title: "Просмотр кода",
    close: "Закрыть просмотр (Esc)",
    modeFile: "Файл",
    modeDiff: "Дифф",
    tooLargeWarning: "Файл превышает лимит предпросмотра (2 MiB).",
    loading: "Загрузка содержимого...",
    noFileSelected: "Файл не выбран.",
  },
  language: {
    ru: "Русский",
    en: "English",
    selectLanguage: "Сменить язык",
  },
};
