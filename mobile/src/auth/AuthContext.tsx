import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { authenticate } from "./biometric";
import {
  getSessionToken,
  getCachedUser,
  setCachedUser,
  setSessionToken,
} from "./session";
import type { SessionUser } from "@/api/types";
import { useStore } from "@/sync/store";
import { startSyncLoop, stopSyncLoop } from "@/sync/engine";

interface AuthState {
  user: SessionUser | null;
  status: "loading" | "locked" | "authed" | "signedout";
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  unlock: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const hydrate = useStore((s) => s.hydrate);

  // On cold start: if we hold a session token, require a biometric unlock before
  // exposing any financial data (VIC-10 "biometric/passcode lock on relaunch").
  useEffect(() => {
    (async () => {
      await hydrate();
      const token = await getSessionToken();
      const cached = await getCachedUser();
      if (token && cached) {
        setUser(cached);
        setStatus("locked");
      } else {
        setStatus("signedout");
      }
    })();
  }, [hydrate]);

  // Drive the background sync loop by auth state.
  useEffect(() => {
    if (status === "authed") {
      const stop = startSyncLoop();
      return stop;
    }
    stopSyncLoop();
  }, [status]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      status,
      async login(email, password) {
        const u = await api.login(email, password);
        await setCachedUser(u);
        setUser(u);
        setStatus("authed");
        void api.track("feature_used", { feature: "mobile_login" }, u.id);
      },
      async signup(email, password, name) {
        const u = await api.signup(email, password, name);
        await setCachedUser(u);
        setUser(u);
        setStatus("authed");
        void api.track("feature_used", { feature: "mobile_signup" }, u.id);
      },
      async logout() {
        await api.logout();
        await setSessionToken(null);
        await setCachedUser(null);
        await useStore.getState().reset();
        setUser(null);
        setStatus("signedout");
      },
      async unlock() {
        const ok = await authenticate();
        if (ok) setStatus("authed");
      },
    }),
    [user, status]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
