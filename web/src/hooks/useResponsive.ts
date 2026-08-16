import { useState, useEffect, useCallback } from 'react';

interface ResponsiveState {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  isMobile: boolean;
  contentPadding: number;
  cardColumns: number;
  maxContentWidth: number;
}

export function useResponsive(): ResponsiveState {
  const getSize = useCallback((): ResponsiveState => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const isMobile = width < 480;

    let contentPadding: number;
    let cardColumns: number;
    let maxContentWidth: number;

    if (width < 480) {
      contentPadding = 20;
      cardColumns = 1;
      maxContentWidth = width;
    } else if (width < 768) {
      contentPadding = 24;
      cardColumns = 2;
      maxContentWidth = width;
    } else if (isLandscape) {
      contentPadding = 32;
      cardColumns = 3;
      maxContentWidth = 900;
    } else {
      contentPadding = 32;
      cardColumns = 2;
      maxContentWidth = 720;
    }

    return { width, height, isTablet, isLandscape, isMobile, contentPadding, cardColumns, maxContentWidth };
  }, []);

  const [state, setState] = useState<ResponsiveState>(getSize);

  useEffect(() => {
    const handler = () => setState(getSize());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [getSize]);

  return state;
}
