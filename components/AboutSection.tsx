import styles from "./AboutSection.module.css";

const intro = [
  `You know the feeling. It's 9pm, you're tired, and when someone asks what you did today, you can't quite say. Not because you were lazy, but because you spent half your energy deciding what to work on instead of actually working. "I'll do it after this." "Should I do homework or the gym first?" "I have no idea where my week went."`,
  `That's not a discipline problem. It's a design problem. Psychologists call it decision fatigue: every choice you make draws from the same limited mental battery, and "what should I do next?" is a choice you're forced to make dozens of times a day. By evening, there's nothing left for the things that actually matter.`,
  `I built Nextly to fix that. My mission is simple: eliminate the time and energy you waste deciding what to do next, so all of it goes into actually doing the thing that matters.`,
];

export default function AboutSection() {
  return (
    <section id="about" className={styles.about}>
      <div className={styles.inner}>
        <span className={styles.tag}>About</span>
        <h2 className={styles.title}>Why I built this?</h2>
        <div className={styles.body}>
          {intro.map((paragraph) => (
            <p key={paragraph.slice(0, 20)}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
