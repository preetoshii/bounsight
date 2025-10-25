import { useRef, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Custom hook to convert vertical mouse wheel scrolling to horizontal scrolling
 * Only applies to web platform with mouse wheels - doesn't affect mobile/touch scrolling
 */
export function useHorizontalScroll() {
  const elRef = useRef();

  useEffect(() => {
    // Only apply on web platform
    if (Platform.OS !== 'web') return;

    const el = elRef.current;
    if (el) {
      const onWheel = (e) => {
        // Only handle vertical wheel events (ignore horizontal trackpad gestures)
        if (e.deltaY === 0) return;

        // Check if we can scroll in the requested direction
        const canScrollLeft = el.scrollLeft > 0 && e.deltaY < 0;
        const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth) && e.deltaY > 0;

        // Only prevent default and translate if we can actually scroll
        if (canScrollLeft || canScrollRight) {
          e.preventDefault();
          // Translate vertical wheel movement to horizontal scroll
          el.scrollBy({ left: e.deltaY, behavior: 'smooth' });
        }
      };

      // Use passive: false to allow preventDefault()
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);

  return elRef;
}
