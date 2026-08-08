import styles from "./RightSidebar.module.css";

interface SystemMessage {
  label: string;
  text: string;
  severity: "info" | "error";
}

const messages: SystemMessage[] = [
  {
    label: "System",
    text: "All tasks placed successfully. No conflicts detected.",
    severity: "info",
  },
  {
    label: "Error",
    text: 'Could not fit "Gym" into today\'s open time. Try Regenerate.',
    severity: "error",
  },
];

export default function RightSidebar() {
  return (
    <div className={styles.sidebar}>
      <div className={styles.noteCard}>
        <div className={styles.noteTitle}>My Note</div>
        <div
          className={styles.noteText}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write yourself a note..."
        />
      </div>

      {messages.map((message) => (
        <div
          key={message.label}
          className={`${styles.messageBox} ${message.severity === "error" ? styles.error : ""}`}
        >
          <div className={styles.messageLabel}>{message.label}</div>
          <div className={styles.messageText}>{message.text}</div>
        </div>
      ))}
    </div>
  );
}
