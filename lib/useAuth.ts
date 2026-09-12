"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, cloudEnabled } from "./supabase";
import { migrateLocal, getProfile, type Profile } from "./store";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);

  const load = useCallback(async (u: User | null) => {
    setUser(u);
    if (u) {
      await migrateLocal(u.id);
      setProfile(await getProfile(u.id));
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const db = supabase();
    if (!db) return;

    let alive = true;

    db.auth.getSession().then(({ data }) => {
      if (!alive) return;
      load(data.session?.user ?? null).finally(() => alive && setReady(true));
    });

    const { data: sub } = db.auth.onAuthStateChange((_e, session) => {
      if (alive) load(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refreshProfile = useCallback(async () => {
    if (user) setProfile(await getProfile(user.id));
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase()?.auth.signOut();
  }, []);

  return { user, profile, ready, refreshProfile, signOut, cloudEnabled };
}
