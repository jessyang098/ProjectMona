"use client";

import { useState, useEffect } from "react";

interface UseChatUIDeps {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
}

export function useChatUI({ isAuthLoading, isAuthenticated }: UseChatUIDeps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [isInitialPrompt, setIsInitialPrompt] = useState(false);

  // Show login prompt on initial load for non-authenticated users (after auth check completes)
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setShowLoginPrompt(true);
      setIsInitialPrompt(true);
    }
  }, [isAuthLoading, isAuthenticated]);

  return {
    showHistory,
    setShowHistory,
    showLoginPrompt,
    setShowLoginPrompt,
    showProfileModal,
    setShowProfileModal,
    showSettingsModal,
    setShowSettingsModal,
    showShopModal,
    setShowShopModal,
    isInitialPrompt,
    setIsInitialPrompt,
  };
}
