import { useState } from "react";
import { Image, Platform, Pressable, Share, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AthleteText as Text } from "./athlete";
import { TrainingPanel, sportIcons, sportNames } from "./athlete-training";
import { CommunityAction, CommunityError } from "./community-ui";
import { RoutePreview } from "./RoutePreview";
import { Field, Loading, useColors } from "./ui";
import { useApp } from "../store/app";
import { useAction } from "../hooks/useAction";
import {
  addComment,
  loadComments,
  setKudos,
  type SocialPost,
} from "../features/community/data";
import { useCurrentAthlete } from "../hooks/useCurrentAthlete";
import { duration, length, pace } from "../utils/format";

export default function SocialActivityCard({
  post,
  userId,
}: {
  post: SocialPost;
  userId: string;
}) {
  const c = useColors(),
    a = useAction(),
    client = useQueryClient();
  const { preferences, workouts } = useApp();
  const [expanded, setExpanded] = useState(false),
    [shareText, setShareText] = useState("");
  const [failedImage, setFailedImage] = useState("");
  const own = post.user_id === userId;
  const local = own
    ? workouts.find(
        (w) =>
          w.id === post.id &&
          w.state === "finished" &&
          (!w.ownerId || w.ownerId === userId),
      )
    : undefined;
  const identity = useCurrentAthlete();
  const avatar = {
    data: identity.userId === userId ? identity.avatarUrl : null,
  };
  const athleteName = own ? identity.fullName || "You" : post.athlete;
  const postPace =
    post.distance_m > 0 && post.moving_seconds > 0
      ? (post.moving_seconds * 1000) / post.distance_m
      : null;
  const summary = `${athleteName} · ${post.title}\n${sportNames[post.sport]} · ${length(post.distance_m, preferences.units)} ${preferences.units} · ${duration(post.moving_seconds * 1000)} moving · ${pace(postPace, preferences.units)} /${preferences.units}\nShared with StravaKinda`;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["community-social"] });
  };
  return (
    <TrainingPanel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 41,
            height: 41,
            borderRadius: 21,
            overflow: "hidden",
            backgroundColor: c.greenSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {own && avatar.data && avatar.data !== failedImage ? (
            <Image
              source={{ uri: avatar.data }}
              accessibilityLabel={`${athleteName} profile photo`}
              style={{ width: 41, height: 41 }}
              onError={() => {
                setFailedImage(avatar.data!);
                identity.onAvatarError();
              }}
            />
          ) : (
            <Text style={{ color: c.forest, fontSize: 14, fontWeight: "700" }}>
              {athleteName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: "700" }}>
            {athleteName}
            {own ? " · You" : ""}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {new Date(post.started_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}{" "}
            · {sportNames[post.sport]}
          </Text>
        </View>
        <Ionicons name={sportIcons[post.sport]} color={c.forest} size={21} />
      </View>
      <Text
        style={{
          color: c.text,
          fontSize: 18,
          fontWeight: "700",
          letterSpacing: -0.3,
        }}
      >
        {post.title}
      </Text>
      {post.description ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>
          {post.description}
        </Text>
      ) : null}
      {local && local.points.length > 1 ? (
        <>
          <RoutePreview points={local.points} />
          <Text style={{ color: c.muted, fontSize: 9 }}>
            Your local route · visible only to you here
          </Text>
        </>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          paddingVertical: 12,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        {[
          [
            `${length(post.distance_m, preferences.units)} ${preferences.units}`,
            "Distance",
          ],
          [duration(post.moving_seconds * 1000), "Moving time"],
          [pace(postPace, preferences.units), `Pace /${preferences.units}`],
        ].map(([value, label], i) => (
          <View
            key={label}
            style={{
              flex: 1,
              minWidth: 0,
              gap: 5,
              paddingLeft: i ? 12 : 0,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: c.border,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: c.text, fontSize: 16, fontWeight: "700" }}
            >
              {value}
            </Text>
            <Text style={{ color: c.muted, fontSize: 10 }}>{label}</Text>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked ? "Remove kudos" : "Give kudos"}
          aria-pressed={post.liked}
          disabled={a.busy}
          onPress={() =>
            void a.run(async () => {
              await setKudos(post.id, userId, post.liked);
              await refresh();
            })
          }
          style={{
            minHeight: 42,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingRight: 9,
          }}
        >
          <Ionicons
            name={post.liked ? "heart" : "heart-outline"}
            size={20}
            color={c.accent}
          />
          <Text style={{ color: c.muted, fontSize: 11 }}>
            {post.activity_reactions?.[0]?.count ?? 0}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments on ${post.title}`}
          aria-expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          style={{
            minHeight: 42,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="chatbubble-outline" size={18} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 11 }}>
            {post.comments?.[0]?.count ?? 0} comments
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share summary"
          disabled={post.visibility !== "public" || a.busy}
          accessibilityState={{
            disabled: post.visibility !== "public" || a.busy,
          }}
          aria-disabled={post.visibility !== "public" || a.busy}
          onPress={() => {
            if (Platform.OS === "web") setShareText(summary);
            else void a.run(() => Share.share({ message: summary }));
          }}
          style={{
            minHeight: 42,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            opacity: post.visibility === "public" ? 1 : 0.4,
          }}
        >
          <Ionicons name="share-social-outline" color={c.muted} size={17} />
          <Text style={{ color: c.muted, fontSize: 11 }}>Share</Text>
        </Pressable>
      </View>
      {shareText ? (
        <View
          style={{
            gap: 10,
            backgroundColor: c.raised,
            padding: 12,
            borderRadius: 9,
          }}
        >
          <Text
            selectable
            style={{ color: c.text, fontSize: 12, lineHeight: 19 }}
          >
            {shareText}
          </Text>
          <CommunityAction
            secondary
            title="Copy summary"
            onPress={() =>
              void a.run(async () => {
                if (!navigator.clipboard?.writeText)
                  throw new Error("Select the summary above to copy it.");
                await navigator.clipboard.writeText(shareText);
              }, "Summary copied.")
            }
          />
        </View>
      ) : null}
      {expanded ? (
        <PostComments post={post} userId={userId} onPosted={refresh} />
      ) : null}
      {a.message ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 11, lineHeight: 18 }}
        >
          {a.message}
        </Text>
      ) : null}
    </TrainingPanel>
  );
}
function PostComments({
  post,
  userId,
  onPosted,
}: {
  post: SocialPost;
  userId: string;
  onPosted: () => Promise<void>;
}) {
  const c = useColors(),
    a = useAction();
  const [draft, setDraft] = useState("");
  const identity = useCurrentAthlete();
  const comments = useQuery({
    queryKey: ["community-comments", userId, post.id],
    queryFn: () => loadComments(post.id),
  });
  return (
    <View style={{ gap: 12 }}>
      {(comments.data?.length ?? 0) >= 30 ? (
        <Text style={{ color: c.muted, fontSize: 10 }}>Latest 30 comments</Text>
      ) : null}
      {comments.isPending ? (
        <Loading />
      ) : comments.error ? (
        <CommunityError
          message={comments.error.message}
          onRetry={() => void comments.refetch()}
        />
      ) : comments.data?.length ? (
        comments.data.map((comment) => (
          <View
            key={comment.id}
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: c.raised,
              gap: 5,
            }}
          >
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 11 }}>
              {comment.user_id === identity.userId
                ? identity.fullName || "You"
                : comment.athlete}
            </Text>
            <Text style={{ color: c.text, fontSize: 12, lineHeight: 19 }}>
              {comment.body}
            </Text>
          </View>
        ))
      ) : (
        <Text style={{ color: c.muted, fontSize: 11 }}>
          Be the first to cheer them on.
        </Text>
      )}
      <Field
        label={`Comment on ${post.title}`}
        placeholder="A little encouragement…"
        value={draft}
        onChangeText={setDraft}
        maxLength={500}
        multiline
      />
      <CommunityAction
        title="Post comment"
        disabled={a.busy || !draft.trim()}
        onPress={() =>
          void a.run(async () => {
            await addComment(post.id, userId, draft);
            setDraft("");
            await Promise.all([comments.refetch(), onPosted()]);
          }, "Comment posted.")
        }
      />
      {a.message ? (
        <Text
          accessibilityRole="alert"
          style={{ color: c.accent, fontSize: 11 }}
        >
          {a.message}
        </Text>
      ) : null}
    </View>
  );
}
