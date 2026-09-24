export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-muted" />
        <div className="mx-auto h-7 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-card" />
      </div>
    </div>
  );
}
