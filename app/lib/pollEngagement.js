import { supabase } from "./supabaseClient";

export async function addComment(pollId, userId, username, text) {
  return await supabase
    .from("poll_comments")
    .insert({ poll_id: pollId, user_id: userId ?? null, username, text })
    .select("*")
    .single();
}

export async function updateComment(commentId, text) {
  return await supabase
    .from("poll_comments")
    .update({ text, edited: true })
    .eq("id", commentId)
    .select("*")
    .single();
}

export async function deleteComment(commentId) {
  return await supabase
    .from("poll_comments")
    .delete()
    .eq("id", commentId);
}

export async function getComments(pollId, { limit = 10, offset = 0 } = {}) {
  return await supabase
    .from("poll_comments")
    .select("*")
    .eq("poll_id", pollId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function likeComment(commentId, userId) {
  return await supabase
    .from("comment_likes")
    .insert({ comment_id: commentId, user_id: userId });
}

export async function unlikeComment(commentId, userId) {
  return await supabase
    .from("comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId);
}

export async function hasLikedComment(commentId, userId) {
  if (!commentId || !userId) return { data: false, error: null };

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  return { data: Boolean(data), error };
}

export async function savePoll(pollId, userId) {
  return await supabase
    .from("saved_polls")
    .insert({ poll_id: pollId, user_id: userId });
}

export async function getSavedPolls(userId) {
  return await supabase
    .from("saved_polls")
    .select("poll_id")
    .eq("user_id", userId);
}

export async function reportPoll(pollId, reason, userId = null) {
  return await supabase
    .from("poll_reports")
    .insert({ poll_id: pollId, user_id: userId, reason });
}

export function calculateWinRate(optionVotes, totalVotes) {
  const votes = Number(optionVotes) || 0;
  const total = Number(totalVotes) || 0;
  if (total <= 0) return 0;
  return (votes / total) * 100;
}

export async function getLiveVoters(pollId) {
  const fiveMinsAgo = new Date(Date.now() - 5 * 60000);

  return await supabase
    .from("poll_votes")
    .select("username, user_id")
    .eq("poll_id", pollId)
    .gte("created_at", fiveMinsAgo.toISOString());
}

export async function isUsernameAvailable(username, excludeUserId) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const { data } = await supabase
    .from("users")
    .select("id")
    .ilike("username", cleanUsername)
    .neq("id", excludeUserId ?? "")
    .maybeSingle();
  return !data;
}

export async function upsertUserProfile({ id, name, username, profile_pic, bio }) {
  return await supabase
    .from("users")
    .upsert({ id, name, username, profile_pic, bio }, { onConflict: "id" })
    .select()
    .single();
}

export async function getUserProfile(userId) {
  return await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
}
