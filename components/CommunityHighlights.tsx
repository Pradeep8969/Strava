import { router } from "expo-router";
import { useSession } from "../hooks/useSession";
import { useFeed } from "../hooks/useFeed";
import { Card, Copy, Button, Loading } from "./ui";
import { SectionHeading } from "./experience";
import { length } from "../utils/format";
import { useApp } from "../store/app";

export function CommunityHighlights() {
  const session = useSession();
  const feed = useFeed(session?.user.id);
  const units = useApp((state) => state.preferences.units);
  return (
    <>
      <SectionHeading
        eyebrow="Shared movement"
        title="From the community"
        action="Athlete feed"
        onPress={() => router.push("/social")}
      />
      {feed.isLoading ? (
        <Loading />
      ) : feed.error ? (
        <Card>
          <Copy>{feed.error.message}</Copy>
          <Button
            secondary
            title="Retry community feed"
            onPress={() => void feed.refetch()}
          />
        </Card>
      ) : feed.data?.length ? (
        feed.data.slice(0, 3).map((post) => (
          <Card key={post.id}>
            <Copy>{post.title}</Copy>
            <Copy muted>
              {post.sport} · {length(post.distance_m, units)} {units} ·{" "}
              {new Date(post.started_at).toLocaleDateString()}
            </Copy>
          </Card>
        ))
      ) : (
        <Card>
          <Copy>
            {session
              ? "Your community is finding its rhythm."
              : "Good company. Shared adventures."}
          </Copy>
          <Copy muted>
            {session
              ? "Shared activities will appear here when available. Your own activity visibility is managed in Settings."
              : "Sign in to discover shared activity summaries, connect with athletes and find a club. Your GPS coordinates stay private."}
          </Copy>
          <Button
            secondary
            title={session ? "Explore clubs" : "Connect with athletes"}
            onPress={() => router.push(session ? "/community" : "/auth")}
          />
        </Card>
      )}
    </>
  );
}
