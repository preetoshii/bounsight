import { useRef, useEffect } from 'react';
import { Platform, findNodeHandle } from 'react-native';

/**
 * Custom hook to convert vertical mouse wheel scrolling to horizontal scrolling
 * Only applies to web platform with mouse wheels - doesn't affect mobile/touch scrolling
 *
 * Usage: Pass the ScrollView ref to this hook
 */
export function useHorizontalScroll(scrollViewRef) {
  useEffect(() => {
    // Only apply on web platform
    if (Platform.OS !== 'web') return;
    if (!scrollViewRef?.current) return;

    // Get the DOM node from the ScrollView ref
    // On web, ScrollView renders as a div, so we can access it directly
    const scrollViewNode = scrollViewRef.current;

    // Try to get the underlying DOM element
    // For react-native-web, the ref itself should be the DOM element
    const el = scrollViewNode.getScrollableNode ? scrollViewNode.getScrollableNode() : scrollViewNode;

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
  }, [scrollViewRef]);
}
