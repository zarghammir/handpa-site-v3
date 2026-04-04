import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl mb-6">🎵</p>
      <h1 className="text-3xl font-bold text-forest mb-3">Page not found</h1>
      <p className="text-forest/60 mb-8 max-w-sm">
        This page doesn&apos;t exist. Maybe you were looking for a handpan lesson?
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-full bg-orange text-white font-semibold hover:opacity-90 transition"
      >
        Back to home
      </Link>
    </main>
  );
}
