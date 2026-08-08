import styles from "./FaqSection.module.css";

const faqs = [
  {
    question: "What is Nextly?",
    answer:
      "A calendar built for people who want to optimize how they spend their time, not just track it. It plans your week around your fixed commitments (classes, calls, anything with a set time) and automatically fits your flexible work, like homework, gym, deep work, and study time, into the open space around them. You stop asking \"what now?\" and start just doing it.",
  },
  {
    question: "How does it decide where to put my tasks?",
    answer:
      "A constraint solver does the thinking you'd otherwise do yourself. It evaluates your open time, task durations, priorities, and preferences, then places every task exactly where it fits best, with zero double-booking. The more you use it, the more it learns you: when you actually focus, how long tasks really take, what you keep pushing off. It's not guessing. It's building a model of how you work best, then running your week on it.",
  },
  {
    question: "Do I lose control over my schedule?",
    answer:
      "No, you gain it back. Every placement is a suggestion: drag it, resize it, delete it. Nothing moves without you clicking Regenerate. You're still the one deciding. I just remove the exhausting part of deciding from a blank slate every single day.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. Your calendar and account data are tied to your login and never shared with anyone. You can delete your data at any time.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className={styles.faq}>
      <div className={styles.inner}>
        <span className={styles.tag}>FAQ</span>
        <h2 className={styles.title}>Questions & Answers </h2>
        <div className={styles.list}>
          {faqs.map((faq) => (
            <details key={faq.question} className={styles.item}>
              <summary className={styles.question}>
                {faq.question}
                <span className={styles.chevron} aria-hidden="true">
                  &#8964;
                </span>
              </summary>
              <p className={styles.answer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
