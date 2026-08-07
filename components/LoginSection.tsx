export default function LoginSection() {
  return (
    <section
      id="login"
      className="flex flex-col items-center border-t border-black/[.08] px-6 py-24 text-center dark:border-white/[.08]"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl dark:text-white">
        Welcome back! Sign in to continue.
      </h2>
      <button
        type="button"
        disabled
        className="mt-8 flex items-center gap-3 rounded-full border border-black/[.08] bg-white px-6 py-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v2.98h3.91c2.29-2.11 3.53-5.22 3.53-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-2.98c-1.08.72-2.47 1.16-4.02 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.09C3.21 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.31c-.25-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.66H1.24C.45 8.24 0 10.07 0 12s.45 3.76 1.24 5.34l4.03-3.03z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.21 2.7 1.24 6.66l4.03 3.09C6.22 6.87 8.87 4.75 12 4.75z"
          />
        </svg>
        Sign in with Google
      </button>
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
        Coming soon
      </p>
    </section>
  );
}
