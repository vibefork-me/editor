import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { routerBasename } from "./routerBasename.ts";
import { AgentConnectionGate } from "./components/AgentConnectionGate.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { OpenPage } from "./pages/OpenPage.tsx";
import { ProjectPage } from "./pages/ProjectPage.tsx";

// Developer view of the canvas on made-up sessions; development builds only.
const CanvasPlayground = import.meta.env.DEV ? lazy(() => import("./canvas/graph/CanvasPlayground.tsx")) : null;

function CenteredRoute({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">{children}</div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <div className="flex min-h-screen flex-col bg-surface font-sans text-text">
        <main className="flex min-h-0 flex-1 flex-col">
          {CanvasPlayground && window.location.pathname.endsWith("/dev/canvas") ? (
            <Suspense fallback={null}>
              <CanvasPlayground />
            </Suspense>
          ) : (
          <AgentConnectionGate>
            <Routes>
              <Route
                path="/"
                element={
                  <CenteredRoute>
                    <HomePage />
                  </CenteredRoute>
                }
              />
              <Route
                path="/open"
                element={
                  <CenteredRoute>
                    <OpenPage />
                  </CenteredRoute>
                }
              />
              <Route path="/:projectId" element={<ProjectPage />} />
            </Routes>
          </AgentConnectionGate>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
