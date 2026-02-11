import { useEffect, useState } from "react";

/**
 * Hook to detect if the viewport is mobile size (< 768px).
 * Uses the 'md' breakpoint from Tailwind (768px) as the threshold.
 *
 * @returns {boolean} True if viewport width is less than 768px
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Create media query for mobile breakpoint (< 768px)
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Handler for media query changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Add listener for viewport changes
    mediaQuery.addEventListener("change", handleChange);

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return isMobile;
}
