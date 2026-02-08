"use client";

import { useState, useEffect } from "react";
import { useAuth, User } from "@/contexts/AuthContext";
import Image from "next/image";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case "fact": return "\u{1F9E0}";
    case "preference": return "\u2764\uFE0F";
    case "event": return "\u{1F4C5}";
    case "feeling": return "\u{1F4AD}";
    default: return "\u{1F4AC}";
  }
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser, isAuthenticated } = useAuth();
  const [nickname, setNickname] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState(false);

  // Initialize nickname from user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setNickname(user.nickname || "");
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, user]);

  // Fetch memories when modal opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      setMemoriesLoading(true);
      setMemoriesError(false);
      fetch(`${BACKEND_URL}/memories`, { credentials: "include" })
        .then(res => {
          if (!res.ok) throw new Error("Failed to load");
          return res.json();
        })
        .then(data => setMemories(data.memories || []))
        .catch(() => setMemoriesError(true))
        .finally(() => setMemoriesLoading(false));
    }
  }, [isOpen, isAuthenticated]);

  const handleDeleteMemory = async (key: string, index: number) => {
    setMemories(prev => prev.filter((_, i) => i !== index));
    try {
      await fetch(`${BACKEND_URL}/memories/${encodeURIComponent(key)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // Silent fail - memory will reappear on next open if delete failed
    }
  };

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedUser = await response.json();
      updateUser({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        nickname: updatedUser.nickname,
        avatarUrl: updatedUser.avatar_url,
      });

      setSuccessMessage("Profile updated!");
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = nickname !== (user.nickname || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 dark:bg-slate-800 dark:border-slate-600 animate-fadeInScale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Profile</h2>

        {/* Avatar and Name Display */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full bg-slate-200">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name || "User"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-medium text-slate-500">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{user.name || "User"}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>

        {/* Nickname Input */}
        <div className="mb-6">
          <label htmlFor="nickname" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            What should Mona call you?
          </label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter a nickname..."
            maxLength={50}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
          />
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Mona will use this name when talking to you. Leave empty to use your account name.
          </p>
        </div>

        {/* What Mona Remembers */}
        {isAuthenticated && (
          <>
            <hr className="my-4 border-slate-200 dark:border-slate-600" />
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">What Mona Remembers</h3>
              {memoriesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="animate-spin h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : memoriesError ? (
                <p className="text-sm text-red-400 dark:text-red-500 py-4 text-center">
                  Could not load memories
                </p>
              ) : memories.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
                  Chat with Mona to build memories together
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {memories.map((mem, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2 text-sm group">
                      <span className="flex-shrink-0 mt-0.5">{getCategoryIcon(mem.category)}</span>
                      <span className="flex-1 text-slate-600 dark:text-slate-300">{mem.content || mem.value}</span>
                      <button
                        onClick={() => handleDeleteMemory(mem.key, i)}
                        className="flex-shrink-0 opacity-40 hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
            {successMessage}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`w-full rounded-xl px-4 py-3 font-medium transition ${
            hasChanges && !isSaving
              ? "bg-pink-500 text-white hover:bg-pink-600"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
