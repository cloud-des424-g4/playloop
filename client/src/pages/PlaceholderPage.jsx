import { GlassPanel } from '../components/ui/GlassPanel.jsx';
import { TextLink } from '../components/ui/TextLink.jsx';
import styles from './PlaceholderPage.module.css';

const FIGMA_FILE = 'https://www.figma.com/design/m8i4PGK6yx0PwGw3aVkSUG/PlayLoop';

// Stand-in for a screen that has not been built yet. Replace the route element with the real page.
export function PlaceholderPage({ title, figmaNode }) {
  return (
    <GlassPanel variant="panel" className={styles.panel}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>This screen has not been built yet.</p>
      {figmaNode && (
        <TextLink
          href={`${FIGMA_FILE}?node-id=${figmaNode.replace(':', '-')}`}
          target="_blank"
          rel="noreferrer"
        >
          Open the design in Figma ↗
        </TextLink>
      )}
    </GlassPanel>
  );
}
