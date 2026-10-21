export function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Vibefork editor</h1>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-xl font-medium text-neutral-200">Vibefork editor</p>
          <p className="text-sm text-neutral-400">Editor shell scaffold</p>
        </div>
      </main>
    </div>
  );
}

export default App;
