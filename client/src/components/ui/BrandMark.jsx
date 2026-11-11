import { Link } from 'react-router';
import brandMark from '../../assets/brand/brand-mark.png';
import { cx } from '../../lib/cx.js';
import styles from './BrandMark.module.css';

// PlayLoop logo as the home link. Figma: Handoff / Brand mark (426:1641), exported at 4x.
export function BrandMark({ className }) {
  return (
    <Link to="/" aria-label="PlayLoop home" className={cx(styles.link, className)}>
      <img src={brandMark} alt="" width={64} height={57} />
    </Link>
  );
}
