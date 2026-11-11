import { Tag } from '../../components/index.js';
import lettering from '../../assets/auth/playloop-lettering.png';
import rouletteBubble from '../../assets/auth/bubble-roulette.png';
import publishBubble from '../../assets/auth/bubble-publish.png';
import styles from './AuthIntro.module.css';

// Left column of the Sign up and Log in screens (Figma "Welcome / PlayLoop brand story",
// 246:489): title, welcome line, the tactile artwork and the Play / Publish / Review tags.
export function AuthIntro({ title, message }) {
  return (
    <div className={styles.intro}>
      <div className={styles.titleFrame}>
        <h1 className={styles.title}>{title}</h1>
        <span className={`${styles.corner} ${styles.topLeft}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.topRight}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.bottomLeft}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.bottomRight}`} aria-hidden="true" />
      </div>
      <p className={styles.message}>{message}</p>

      <div className={styles.artwork} aria-hidden="true">
        <div className={styles.leaf} />
        <img className={styles.lettering} src={lettering} alt="" width={568} height={341} />
        <div className={`${styles.bubble} ${styles.rouletteBubble}`}>
          <img src={rouletteBubble} alt="" width={80} height={80} />
        </div>
        <div className={`${styles.bubble} ${styles.publishBubble}`}>
          <img src={publishBubble} alt="" width={72} height={72} />
        </div>
      </div>

      <ul className={styles.tags} aria-label="What you can do on PlayLoop">
        <li>
          <Tag tone="sky">Play</Tag>
        </li>
        <li>
          <Tag tone="lime">Publish</Tag>
        </li>
        <li>
          <Tag tone="lilac">Review</Tag>
        </li>
      </ul>
    </div>
  );
}
