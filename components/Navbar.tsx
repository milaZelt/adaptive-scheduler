export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/[.08] bg-white/80 backdrop-blur dark:border-white/[.08] dark:bg-black/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="#top" className="text-sm font-semibold tracking-tight">
          Home
        </a>
        <div className="flex items-center gap-6 text-sm font-medium">
          <a
            href="#login"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            Login
          </a>
          <a
            href="#about"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            About
          </a>
          <a
            href="#faq"
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
          >
            FAQ
          </a>
        </div>
      </nav>
    </header>
  );
}
