const POLICY_NAME = "vibefork";

type TrustedTypesWindow = Window &
  typeof globalThis & {
    trustedTypes?: {
      getPolicy(name: string): unknown;
      createPolicy(
        name: string,
        rules: {
          createHTML?: (input: string) => string;
          createScript?: (input: string) => string;
          createScriptURL?: (input: string) => string;
        },
      ): unknown;
    };
  };

/** Default Trusted Types policy for dynamic script sinks (S-054). */
export function registerTrustedTypes(): void {
  const w = window as TrustedTypesWindow;
  if (!w.trustedTypes) {
    return;
  }
  if (w.trustedTypes.getPolicy(POLICY_NAME)) {
    return;
  }
  w.trustedTypes.createPolicy(POLICY_NAME, {
    createHTML: (input: string) => input,
    createScript: (input: string) => input,
    createScriptURL: (input: string) => input,
  });
}
