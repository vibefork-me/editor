/**
 * Feature flag for GitHub fork saving in editor.
 * In MVP, saving to a GitHub fork is hidden (per MVP.md: "Личной копии на GitHub в MVP нет").
 * Enabled build-time only via VITE_ENABLE_GITHUB_SAVE=1 or "true", matching READY_PATHS in web.
 */
export function isGithubSaveEnabled(): boolean {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  return (
    metaEnv?.VITE_ENABLE_GITHUB_SAVE === "1" ||
    metaEnv?.VITE_ENABLE_GITHUB_SAVE === "true"
  );
}
