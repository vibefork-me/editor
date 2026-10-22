const POLICY_NAME = "vibefork";

type TrustedTypesWindow = Window &
  typeof globalThis & {
    trustedTypes?: {
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

let policyCreated = false;

/** Default Trusted Types policy for dynamic script sinks (S-054). */
export function registerTrustedTypes(): void {
  const w = window as TrustedTypesWindow;
  if (!w.trustedTypes || typeof w.trustedTypes.createPolicy !== "function") {
    return;
  }
  if (policyCreated) {
    return;
  }
  try {
    w.trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (input: string) => input,
      createScript: (input: string) => input,
      createScriptURL: (input: string) => input,
    });
    policyCreated = true;
  } catch {
    // Policy already created (e.g. across HMR module updates)
  }
}
