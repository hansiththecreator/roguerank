import { supabase } from "./supabaseClient";

export function getPollCreatorUsername(poll) {
  return poll?.creatorUsername || poll?.creatorProfile?.username || poll?.creator || "guest";
}

export function getPollCreatorName(poll) {
  return poll?.creatorName || poll?.creatorProfile?.name || "";
}

export function getPollCreatorHandle(poll) {
  const username = String(getPollCreatorUsername(poll) || "guest").replace(/^@/, "");
  return `@${username}`;
}

export async function applyCreatorProfilesToPolls(polls) {
  const sourcePolls = polls || [];
  const creatorIds = [
    ...new Set(
      sourcePolls
        .map((poll) => poll.creatorId)
        .filter(Boolean)
        .map(String)
    ),
  ];

  if (creatorIds.length === 0) return sourcePolls;

  const { data, error } = await supabase
    .from("users")
    .select("id, name, username, profile_pic")
    .in("id", creatorIds);

  if (error) {
    console.error("Failed loading creator profiles:", error);
    return sourcePolls;
  }

  const profileById = new Map((data || []).map((profile) => [String(profile.id), profile]));

  return sourcePolls.map((poll) => {
    const profile = poll.creatorId ? profileById.get(String(poll.creatorId)) : null;
    if (!profile) return poll;

    return {
      ...poll,
      creatorUsername: profile.username || poll.creatorUsername || poll.creator,
      creatorName: profile.name || poll.creatorName || "",
      creatorProfile: profile,
    };
  });
}
