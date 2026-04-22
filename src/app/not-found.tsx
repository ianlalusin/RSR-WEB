import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-extrabold tracking-tight text-primary">404</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go Home
      </Link>
    </div>
  );
}
