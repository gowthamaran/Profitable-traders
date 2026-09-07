import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="label">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
        THIS PAGE GOT LIQUIDATED.
      </h1>
      <p className="mt-3 text-sm text-muted">
        Unlike the traders in our database, you can recover from this.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-sm bg-paper px-4 py-2.5 font-mono text-2xs font-semibold tracking-widest text-ink-950 transition-opacity hover:opacity-90"
      >
        RETURN HOME
      </Link>
    </div>
  );
}
