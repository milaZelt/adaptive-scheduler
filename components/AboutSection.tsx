const intro = [
  `You know the feeling. It's 9pm, you're tired, and when someone asks what you did today, you can't quite say. Not because you were lazy, but because you spent half your energy deciding what to work on instead of actually working. "I'll do it after this." "Should I do homework or the gym first?" "I have no idea where my week went."`,
  `That's not a discipline problem. It's a design problem. Psychologists call it decision fatigue: every choice you make draws from the same limited mental battery, and "what should I do next?" is a choice you're forced to make dozens of times a day. By evening, there's nothing left for the things that actually matter.`,
  `I built Nextly to fix that. My mission is simple: eliminate the time and energy you waste deciding what to do next, so all of it goes into actually doing the thing that matters.`,
];

export default function AboutSection() {
  return (
    <section
      id="about"
      className="border-t border-black/[.08] px-6 py-24 dark:border-white/[.08]"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-black sm:text-3xl dark:text-white">
          About
        </h2>
        <div className="mt-6 flex flex-col gap-4 text-zinc-600 dark:text-zinc-400">
          {intro.map((paragraph) => (
            <p key={paragraph.slice(0, 20)}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
