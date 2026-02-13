"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

interface UserMenuProps {
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenShop: () => void;
}

export default function UserMenu({ onOpenLogin, onOpenProfile, onOpenSettings, onOpenShop }: UserMenuProps) {
  const { user, isAuthenticated, logout, guestMessagesRemaining } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  // Not authenticated - show settings, shop, and sign in buttons
  if (!isAuthenticated) {
    return (
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Settings button - always visible */}
        <button
          onClick={onOpenSettings}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 backdrop-blur-xl border border-slate-300 text-slate-700 transition-all duration-200 hover:bg-white/70 active:scale-95 dark:bg-slate-800/50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700/60"
          title="Settings"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Shop button - hidden for launch (all items are placeholder) */}

        {/* Sign in button */}
        <button
          onClick={onOpenLogin}
          className="inline-flex items-center gap-2 rounded-xl bg-white/50 backdrop-blur-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700 transition-all duration-200 hover:bg-white/70 active:scale-95 dark:bg-slate-800/50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700/60"
        >
          {guestMessagesRemaining !== null && (
            <span className={`text-xs ${guestMessagesRemaining <= 3 ? "text-amber-600 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"}`}>
              {guestMessagesRemaining} left
            </span>
          )}
          <span className="font-medium">Sign in</span>
        </button>
      </div>
    );
  }

  // Authenticated - show user avatar with dropdown
  return (
    <div ref={menuRef} className="relative pointer-events-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl bg-white/50 backdrop-blur-xl border border-slate-300 p-1.5 pr-3 text-slate-700 transition-all duration-200 hover:bg-white/70 active:scale-95 dark:bg-slate-800/50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700/60"
      >
        {/* User avatar */}
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name || "User"}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        {/* Chevron */}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 dark:border-slate-600 dark:bg-slate-800">
          {/* User info */}
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <p className="font-medium text-slate-900 truncate dark:text-white">{user?.name || "User"}</p>
            <p className="text-sm text-slate-500 truncate dark:text-slate-400">{user?.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {/* Profile */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>

            {/* Shop - hidden for launch (all items are placeholder) */}
          </div>

          {/* Divider */}
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />

          {/* Sign out */}
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
