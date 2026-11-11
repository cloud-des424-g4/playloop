import { Link } from 'react-router';
import { BrandMark } from '../../components/index.js';
import styles from './AuthNavigation.module.css';

// Header of the Sign up and Log in screens (Figma "Brand navigation", 246:479): the logo and one
// link, without the account links of MainNavigation.
export function AuthNavigation() {
  return (
    <nav aria-label="Main" className={styles.nav}>
      <BrandMark />
      <Link to="/" className={styles.link}>
        Explore Games ↗
      </Link>
    </nav>
  );
}
