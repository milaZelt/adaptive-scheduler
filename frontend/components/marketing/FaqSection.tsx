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
      "A constraint solver does the thinking you'd otherwise do yourself. Every time you click Update Schedule, it evaluates your open time, task durations, priorities, and deadlines, then places every task exactly where it fits best, with zero double-booking. It's not guessing - it's solving your week like a real optimization problem, fresh, every time you ask it to.",
  },
  {
    question: "Do I lose control over my schedule?",
    answer:
      "No, you gain it back. Nextly places your flexible tasks, but you're never locked into where it puts them: edit or delete the task itself and the next Update Schedule reflects that, or just mark a session Completed or Missed as you go. Nothing moves without you clicking Update Schedule. You're still the one deciding. I just remove the exhausting part of deciding from a blank slate every single day.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. Your calendar and account data are tied to your login and never shared with anyone. You can delete individual tasks, events, and calendars whenever you want.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className={styles.faq}>
      <div className={styles.inner}>
        <div className={styles.aside} data-reveal="1">
          <span className={styles.tag}>FAQ</span>
          <h2 className={styles.title}>Questions &amp; Answers</h2>
        </div>
        <div className={styles.list}>
          {faqs.map((faq, i) => (
            <details
              key={faq.question}
              className={styles.item}
              data-reveal={i + 1}
            >
              <summary className={styles.question}>
                <span className={styles.number}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{faq.question}</span>
                <span className={styles.indicator} aria-hidden="true" />
              </summary>
              <p className={styles.answer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
