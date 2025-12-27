"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  guestSessionId: string | null;
  guestMessagesRemaining: number | null;
  guestMessageLimit: number;
  isGuestLimitReached: boolean;
  login: () => void;
  logout: () => Promise<void>;
  updateGuestStatus: (remaining: number) => void;
  setGuestLimitReached: (reached: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Generate or retrieve guest session ID
function getGuestSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem("mona_guest_session_id");
  if (!sessionId) {
    sessionId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    localStorage.setItem("mona_guest_session_id", sessionId);
  }
  return sessionId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [guestMessagesRemaining, setGuestMessagesRemaining] = useState<number | null>(null);
  const [guestMessageLimit] = useState(10);
  const [isGuestLimitReached, setIsGuestLimitReached] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/me`, {
          credentials: "include",
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Not authenticated, set up guest session
          const sessionId = getGuestSessionId();
          setGuestSessionId(sessionId);

          // Check guest status
          const guestResponse = await fetch(
            `${BACKEND_URL}/auth/guest-status?session_id=${sessionId}`
          );
          if (guestResponse.ok) {
            const guestData = await guestResponse.json();
            setGuestMessagesRemaining(guestData.messages_remaining);
            setIsGuestLimitReached(guestData.limit_reached);
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Set up guest session on error
        const sessionId = getGuestSessionId();
        setGuestSessionId(sessionId);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Check for auth success after OAuth redirect
  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth") === "success") {
      // Remove the query param and refresh auth status
      window.history.replaceState({}, "", window.location.pathname);

      // Re-check auth
      fetch(`${BACKEND_URL}/auth/me`, { credentials: "include" })
        .then((res) => res.json())
        .then((userData) => {
          setUser(userData);
          setGuestSessionId(null);
          setGuestMessagesRemaining(null);
          setIsGuestLimitReached(false);
        })
        .catch(console.error);
    }
  }, []);

  const login = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = `${BACKEND_URL}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }

    setUser(null);
    const sessionId = getGuestSessionId();
    setGuestSessionId(sessionId);
  }, []);

  const updateGuestStatus = useCallback((remaining: number) => {
    setGuestMessagesRemaining(remaining);
    if (remaining <= 0) {
      setIsGuestLimitReached(true);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        guestSessionId,
        guestMessagesRemaining,
        guestMessageLimit,
        isGuestLimitReached,
        login,
        logout,
        updateGuestStatus,
        setGuestLimitReached,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
