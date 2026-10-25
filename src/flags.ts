/**
 * Feature flag for GitHub fork saving in editor.
 * In MVP, saving to a GitHub fork is hidden (per MVP.md: "Личной копии на GitHub в MVP нет").
 * Can be enabled via import.meta.env.VITE_ENABLE_GITHUB_SAVE === "true" or "1",
 * or window.__VF_FLAGS__?.enableGithubSave. Default: false.
 */
export function isGithubSaveEnabled(): boolean {
  if (typeof window !== "undefined") {
    const override = (window as unknown as { __VF_FLAGS__?: { enableGithubSave?: boolean } })
      .__VF_FLAGS__?.enableGithubSave;
    if (typeof override === "boolean") return override;
  }
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  return (
    metaEnv?.VITE_ENABLE_GITHUB_SAVE === "true" ||
    metaEnv?.VITE_ENABLE_GITHUB_SAVE === "1"
  );
}
