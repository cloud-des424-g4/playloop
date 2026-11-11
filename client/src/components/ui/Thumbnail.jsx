import { cx } from '../../lib/cx.js';
import styles from './Thumbnail.module.css';

// 56 px game thumbnail. Figma: "Frame 32" (143:203).
export function Thumbnail({ src, alt = '', className }) {
  return (
    <img src={src} alt={alt} width={56} height={56} className={cx(styles.thumbnail, className)} />
  );
}
