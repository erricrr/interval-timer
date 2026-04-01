"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { LogOut } from "lucide-react";
import { auth, provider } from "../lib/firebase";

interface LoginButtonProps {
  className?: string;
}

// Bold single-path Google "G" icon
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4" fill="currentColor">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export function LoginButton({ className }: LoginButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("User:", result.user);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-text-subtle/10 animate-pulse" />
      </div>
    );
  }

  // Show user avatar and logout button when logged in
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-text-subtle/20">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-accent flex items-center justify-center text-xs font-bold text-bg">
              {(user.displayName || user.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-full text-text-muted hover:text-text hover:bg-text-subtle/10 transition-all hover:scale-110 active:scale-95"
          title="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  // Show Google icon + Log in text when not logged in
  return (
    <button
      onClick={handleLogin}
      className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-text-muted hover:text-text hover:bg-text-subtle/10 rounded-full transition-all hover:scale-105 active:scale-95 ${className || ""}`}
      title="Sign in with Google"
    >
      <GoogleIcon />
      <span>Log in</span>
    </button>
  );
}
