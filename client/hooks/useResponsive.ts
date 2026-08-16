import { useState, useEffect } from 'react';
import { Dimensions, Platform, ViewStyle } from 'react-native';

export interface ResponsiveLayout {
  width: number;
  height: number;
  isTablet: boolean;
  isWeb: boolean;
  isLandscape: boolean;
  /** Content max width for large screens */
  maxContentWidth: number;
  /** Number of columns for card grids */
  cardColumns: number;
  /** Horizontal padding for content */
  contentPadding: number;
  /** Whether to use side padding for centered layout */
  useWideLayout: boolean;
  /** Style object to apply to root View for max-width centering */
  maxWidthStyle: ViewStyle;
}

export function useResponsive(): ResponsiveLayout {
  const getLayout = (): ResponsiveLayout => {
    const window = Dimensions.get('window');
    const width = window.width;
    const height = window.height;
    const isWeb = Platform.OS === 'web';
    const isLandscape = width > height;
    const isTablet = width >= 768 || height >= 768;

    // Content width: larger for landscape tablets
    let maxContentWidth: number;
    let cardColumns: number;
    let contentPadding: number;

    if (isTablet && isLandscape) {
      // Landscape tablet: wider content, more columns
      maxContentWidth = 900;
      cardColumns = width >= 1024 ? 3 : 2;
      contentPadding = 32;
    } else if (isTablet) {
      // Portrait tablet
      maxContentWidth = 720;
      cardColumns = 2;
      contentPadding = 32;
    } else if (width >= 480) {
      // Large phone (e.g. landscape phone)
      maxContentWidth = 600;
      cardColumns = 2;
      contentPadding = 24;
    } else {
      // Small phone
      maxContentWidth = width;
      cardColumns = 1;
      contentPadding = 20;
    }

    const useWideLayout = isTablet || width >= 480;

    const maxWidthStyle: ViewStyle = useWideLayout
      ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' }
      : {};

    return {
      width,
      height,
      isTablet,
      isWeb,
      isLandscape,
      maxContentWidth,
      cardColumns,
      contentPadding,
      useWideLayout,
      maxWidthStyle,
    };
  };

  const [layout, setLayout] = useState<ResponsiveLayout>(getLayout);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setLayout(getLayout());
    });
    return () => subscription?.remove();
  }, []);

  return layout;
}
