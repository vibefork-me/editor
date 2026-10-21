import { BrowserRouter, Route, Routes } from "react-router-dom";
import { routerBasename } from "./routerBasename.ts";
import { HomePage } from "./pages/HomePage.tsx";
import { OpenPage } from "./pages/OpenPage.tsx";
import { ProjectPage } from "./pages/ProjectPage.tsx";

export function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Vibefork editor</h1>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/open" element={<OpenPage />} />
            <Route path="/:projectId" element={<ProjectPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
