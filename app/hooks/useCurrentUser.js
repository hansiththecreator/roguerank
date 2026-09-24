"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

let anonymousSignInPromise = null;

function buildCurrentUser(authUserId, cachedUser = {}) {
  return {
    ...cachedUser,
    id: authUserId,
    name: cachedUser.name || "",
    username: cachedUser.username || "Guest",
    pfp: cachedUser.pfp || cachedUser.profile_pic || "",
    likes: cachedUser.likes || [],
    savedPolls: cachedUser.savedPolls || [],
  };
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCurrentUserLoading, setIsCurrentUserLoading] = useState(true);
  const authUserIdRef = useRef(null);

  const persistCurrentUser = useCallback((authUserId, cachedUser) => {
    if (!authUserId) return null;
    const nextUser = buildCurrentUser(authUserId, cachedUser || {});
    authUserIdRef.current = authUserId;
    if (typeof window !== "undefined") {
      localStorage.setItem("rankr_user", JSON.stringify(nextUser));
    }
    setCurrentUser(nextUser);
    return nextUser;
  }, []);

  const loadUserProfile = useCallback(async (authUserId, cachedUser) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();

    if (error) {
      console.error("Profile load failed:", error);
      return persistCurrentUser(authUserId, cachedUser);
    }

    return persistCurrentUser(authUserId, {
      ...cachedUser,
      ...(data || {}),
      pfp: data?.profile_pic || cachedUser?.pfp || "",
      joinedAt: cachedUser?.joinedAt || Date.parse(data?.created_at || "") || Date.now(),
    });
  }, [persistCurrentUser]);

  const updateCurrentUser = useCallback((value) => {
    setCurrentUser((previous) => {
      const authUserId = authUserIdRef.current;
      if (!authUserId) return previous;
      const nextUser = typeof value === "function" ? value(previous) : value;
      if (nextUser) {
        const userWithAuthId = buildCurrentUser(authUserId, nextUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("rankr_user", JSON.stringify(userWithAuthId));
        }
        return userWithAuthId;
      }
      return nextUser;
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    function readCachedUser() {
      try {
        return JSON.parse(localStorage.getItem("rankr_user") || "{}") || {};
      } catch {
        return {};
      }
    }

    async function getOrCreateAnonymousSession() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (sessionData.session) return sessionData.session;

      if (!anonymousSignInPromise) {
        anonymousSignInPromise = supabase.auth
          .signInAnonymously()
          .finally(() => {
            anonymousSignInPromise = null;
          });
      }

      const { data, error } = await anonymousSignInPromise;
      if (error) throw error;
      return data.session;
    }

    async function initializeCurrentUser() {
      try {
        const session = await getOrCreateAnonymousSession();
        if (!isActive || !session?.user?.id) return;
        await loadUserProfile(session.user.id, readCachedUser());
      } catch (error) {
        console.error("Anonymous auth initialization failed:", error);
      } finally {
        if (isActive) {
          setIsCurrentUserLoading(false);
        }
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      if (!session?.user?.id) return;
      loadUserProfile(session.user.id, readCachedUser());
      setIsCurrentUserLoading(false);
    });

    initializeCurrentUser();

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  return { currentUser, setCurrentUser: updateCurrentUser, isCurrentUserLoading };
}
