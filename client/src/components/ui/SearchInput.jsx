import searchIcon from '../../assets/icons/search.svg';
import submitIcon from '../../assets/icons/play.svg';
import { cx } from '../../lib/cx.js';
import styles from './SearchInput.module.css';

// Search bar with leading icon and trailing submit. Figma: "search bar" (196:135).
// `onSearch` receives the submitted query; pass value/onChange for a controlled input.
export function SearchInput({
  label = 'Search games',
  placeholder = 'Search Games',
  onSearch,
  className,
  ...inputProps
}) {
  function handleSubmit(event) {
    event.preventDefault();
    onSearch?.(event.currentTarget.elements.q.value.trim());
  }

  return (
    <form role="search" className={cx(styles.search, className)} onSubmit={handleSubmit}>
      <img src={searchIcon} alt="" className={styles.icon} />
      <input
        type="search"
        name="q"
        aria-label={label}
        placeholder={placeholder}
        className={styles.input}
        {...inputProps}
      />
      <button type="submit" className={styles.submit} aria-label="Submit search">
        <img src={submitIcon} alt="" />
      </button>
    </form>
  );
}
