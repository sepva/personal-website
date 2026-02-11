import { useState } from "react";

/**
 * Custom hook for managing session ID persistence across page reloads.
 * Generates a unique session ID for each client connection to ensure
 * each client gets their own Durable Object instance.
 *
 * @returns sessionId - A unique session identifier persisted in sessionStorage
 */
export function useSessionManagement() {
  const [sessionId] = useState(() => {
    // Try to get existing session ID from sessionStorage (persists across page reloads)
    const existingId = sessionStorage.getItem("chat-session-id");
    if (existingId) {
      return existingId;
    }

    // Generate new session ID using cryptographically secure random values
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    const randomPart = Array.from(randomBytes, (b) => b.toString(36))
      .join("")
      .slice(0, 9);
    const newId = `session-${Date.now()}-${randomPart}`;

    sessionStorage.setItem("chat-session-id", newId);
    return newId;
  });

  return { sessionId };
}
