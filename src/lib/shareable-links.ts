/**
 * Utilities for handling shareable content links
 */

/**
 * Parse shareable link identifier from URL query parameters
 * @returns The shareable link identifier or null if not present
 */
export function parseShareableLinkFromURL(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('item');
}

/**
 * Build a shareable URL for a content item
 * @param shareableLink - The unique shareable link identifier
 * @returns Full URL with query parameter
 */
export function buildShareableURL(shareableLink: string): string {
  if (typeof window === 'undefined') return '';
  
  const url = new URL(window.location.origin);
  url.searchParams.set('item', shareableLink);
  return url.toString();
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Clipboard API not available');
  }

  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (err) {
      document.body.removeChild(textArea);
      throw new Error('Failed to copy to clipboard');
    }
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Share content using native share API or fallback to clipboard
 * @param url - URL to share
 * @param title - Title of the content
 * @returns Promise that resolves with the method used ('native' or 'clipboard')
 */
export async function shareContent(
  url: string,
  title: string
): Promise<'native' | 'clipboard'> {
  if (typeof window === 'undefined') {
    throw new Error('Share API not available');
  }

  // Try native share API first (mainly for mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        url,
      });
      return 'native';
    } catch (err) {
      // User cancelled or share failed, fall back to clipboard
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled, don't fall back
        throw err;
      }
    }
  }

  // Fallback to clipboard
  await copyToClipboard(url);
  return 'clipboard';
}
