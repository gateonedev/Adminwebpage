/**
 * Admin sayfaları için ortak yükleme iskeleti. Navigasyonda anında görünür;
 * sayfanın sunucu verisi hazır olunca içerik yerine oturur.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      {/* PageHeader iskeleti */}
      <div className="mb-8">
        <div className="h-7 w-48 rounded-md bg-surfaceUp" />
        <div className="mt-2 h-4 w-80 max-w-full rounded-md bg-surfaceUp/70" />
      </div>
      {/* Liste iskeleti */}
      <div className="border-t border-sep divide-y divide-sep">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-4">
            <div className="h-4 flex-1 max-w-56 rounded bg-surfaceUp" />
            <div className="h-4 w-40 rounded bg-surfaceUp/70 hidden sm:block" />
            <div className="h-5 w-16 rounded-full bg-surfaceUp/70" />
            <div className="h-4 w-24 rounded bg-surfaceUp/50 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
