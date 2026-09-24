export default function PageSkeleton() {
  return (
    <div className="min-h-[60vh] space-y-6" aria-label="Memuat halaman">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-card" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    </div>
  );
}
