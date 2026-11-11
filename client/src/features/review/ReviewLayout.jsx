import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppLayout } from '../../components/index.js';
import brandMark from '../../assets/brand/brand-mark.png';
import styles from './Review.module.css';

const HeaderSlot = createContext(null);

// Shell for the review flow. Figma "Review header" (281:711): only the logo, plus whatever the
// current screen puts on the right (Playtime, Leave). The logo is not a link, so a reviewer leaves
// through Leave, which the screens show only where Figma does.
export function ReviewLayout() {
  const [slot, setSlot] = useState(null);
  return (
    <HeaderSlot.Provider value={slot}>
      <AppLayout
        navigation={
          <header className={styles.header}>
            <img src={brandMark} alt="PlayLoop" width={64} height={57} className={styles.logo} />
            <div ref={setSlot} className={styles.headerActions} />
          </header>
        }
      />
    </HeaderSlot.Provider>
  );
}

// Renders its children on the right of the review header while mounted.
export function ReviewHeaderActions({ children }) {
  const slot = useContext(HeaderSlot);
  return slot ? createPortal(children, slot) : null;
}
