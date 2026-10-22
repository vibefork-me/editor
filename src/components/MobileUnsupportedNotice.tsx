export function MobileUnsupportedNotice() {
  return (
    <div
      className="mx-auto w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900/90 p-8 text-center shadow-lg"
      role="status"
    >
      <h2 className="text-lg font-semibold text-neutral-100">Нужен компьютер с Windows</h2>
      <p className="mt-3 text-sm text-neutral-400">
        Веб-IDE предназначена для компьютеров под управлением Windows.
      </p>
    </div>
  );
}
