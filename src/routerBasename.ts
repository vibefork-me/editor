/** When the shell is served under the agent UI path, History API routes use this basename. */
export function routerBasename(): string {
  const { pathname } = window.location;
  if (pathname === "/ui" || pathname.startsWith("/ui/")) {
    return "/ui";
  }
  return "";
}
