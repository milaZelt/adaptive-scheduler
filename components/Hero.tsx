export default function Hero() {
  return (
    <section
      id="top"
      className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black sm:text-6xl dark:text-white">
        Nextly
      </h1>
      <p className="mt-6 max-w-xl text-lg text-zinc-600 sm:text-xl dark:text-zinc-400">
        Welcome! Stop deciding. Start doing.
      </p>
      <a
        href="#login"
        className="mt-10 rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Get started
      </a>
    </section>
  );
}
