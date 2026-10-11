"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignInLink } from "@/components/SignInLink";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getComments, getHiddenComments, setCommentHidden, type Comment } from "@/lib/api-client";
import { CommentListSkeleton } from "../skeletons";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { CommentThread } from "./CommentThread";
import { usePagedComments } from "./usePagedComments";

type Props = {
  videoId: string;
  initialCount: number;
  signedIn: boolean;
  isOwner: boolean;
  // Off: the owner can read, hide and delete, but nobody can write or edit.
  commentsEnabled: boolean;
};

function ErrorRow({
  message,
  action,
  onAction,
  busy = false,
}: {
  message: string;
  action: string;
  onAction: () => void;
  busy?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm">
      <span className="text-destructive">{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onAction} disabled={busy}>
        {busy && <Spinner />}
        {action}
      </Button>
    </div>
  );
}

function LoadMore({ loading, onClick, children }: { loading: boolean; onClick: () => void; children: string }) {
  return (
    <div>
      <Button type="button" variant="outline" onClick={onClick} disabled={loading}>
        {loading && <Spinner />}
        {children}
      </Button>
    </div>
  );
}

export function CommentSection({ videoId, initialCount, signedIn, isOwner, commentsEnabled }: Props) {
  // Replying is writing, so it goes with the form.
  const canWrite = signedIn && commentsEnabled;
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [tab, setTab] = useState("comments");
  const main = usePagedComments((page) => getComments(videoId, page));
  const hidden = usePagedComments((page) => getHiddenComments(videoId, page));
  const [hiddenMessage, setHiddenMessage] = useState<string>();

  // Loads the first pages once per Video, and again whenever the server hands
  // down a fresh count (after the owner hides or un-hides something).
  useEffect(() => {
    setCount(initialCount);
    void main.load(1, true);
    if (isOwner) void hidden.load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, initialCount]);

  // Hiding or un-hiding changes what everyone sees, so the count comes from the server again.
  function moderated() {
    router.refresh();
    if (isOwner) void hidden.load(1, true);
  }

  async function unhide(comment: Comment) {
    setHiddenMessage(undefined);
    const result = await setCommentHidden(videoId, comment.id, false);
    if (!result.ok) return setHiddenMessage(result.message);
    toast.success("Comment unhidden");
    hidden.setItems((current) => current.filter((item) => item.id !== comment.id));
    hidden.setTotal((current) => current - 1);
    router.refresh();
    void main.load(1, true);
  }

  const showingFirstLoad = main.loading && !main.loaded;

  const comments = (
    <div className="grid gap-6">
      {!commentsEnabled ? null : signedIn ? (
        <CommentComposer
          videoId={videoId}
          label="Add a comment"
          onPosted={(comment) => {
            main.setItems((current) => [comment, ...current]);
            setCount((current) => current + 1);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          <SignInLink>
            Sign in
          </SignInLink>{" "}
          to write a comment.
        </p>
      )}

      {main.error && <ErrorRow message={main.error} action="Retry" onAction={() => main.load()} busy={main.loading} />}
      {showingFirstLoad && <CommentListSkeleton />}
      {main.loaded && main.items.length === 0 && !main.error && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          {canWrite ? "Be the first to comment." : "No comments yet."}
        </p>
      )}

      {main.items.length > 0 && (
        <div className="grid gap-6">
          {main.items.map((comment) => (
            <CommentThread
              key={comment.id}
              videoId={videoId}
              signedIn={signedIn}
              comment={comment}
              canWrite={canWrite}
              canEdit={commentsEnabled}
              isOwner={isOwner}
              onChanged={(changed) =>
                main.setItems((current) =>
                  current.map((item) => (item.id === changed.id ? { ...changed, replyCount: item.replyCount } : item)),
                )
              }
              onHidden={isOwner ? moderated : undefined}
              onDeleted={() => {
                setCount((current) => current - 1);
                // With Replies it stays as a placeholder; without, it disappears.
                main.setItems((current) =>
                  comment.replyCount > 0
                    ? current.map((item) =>
                        item.id === comment.id ? { ...item, deleted: true, isAuthor: false } : item,
                      )
                    : current.filter((item) => item.id !== comment.id),
                );
              }}
              onReplyHidden={moderated}
              onReplyPosted={() => {
                setCount((current) => current + 1);
                main.setItems((current) =>
                  current.map((item) =>
                    item.id === comment.id ? { ...item, replyCount: item.replyCount + 1 } : item,
                  ),
                );
              }}
              onReplyDeleted={() => {
                setCount((current) => current - 1);
                // A placeholder goes with its last Reply.
                main.setItems((current) =>
                  current.flatMap((item) => {
                    if (item.id !== comment.id) return [item];
                    const replyCount = item.replyCount - 1;
                    return item.deleted && replyCount === 0 ? [] : [{ ...item, replyCount }];
                  }),
                );
              }}
            />
          ))}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {main.loaded ? `${main.items.length} ${main.items.length === 1 ? "comment" : "comments"} shown` : ""}
      </p>

      {main.hasMore && <LoadMore loading={main.loading} onClick={() => main.load()}>Load more comments</LoadMore>}
    </div>
  );

  return (
    <section className="mt-4 grid gap-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-xl font-semibold">
        {count.toLocaleString("en")} {count === 1 ? "comment" : "comments"}
      </h2>

      {isOwner ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="hidden">Hidden ({hidden.total})</TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="pt-4">
            {comments}
          </TabsContent>
          <TabsContent value="hidden" className="grid gap-6 pt-4">
            <p className="text-sm text-muted-foreground">
              Hidden comments are gone for everyone but you and their authors. Hiding is not deleting; unhide to bring
              one back.
            </p>
            {(hidden.error || hiddenMessage) && (
              <ErrorRow
                message={(hidden.error ?? hiddenMessage)!}
                action={hidden.error ? "Retry" : "Dismiss"}
                onAction={() => (hidden.error ? hidden.load() : setHiddenMessage(undefined))}
                busy={hidden.loading}
              />
            )}
            {hidden.loading && !hidden.loaded && <CommentListSkeleton count={2} />}
            {hidden.loaded && hidden.items.length === 0 && !hidden.error && (
              <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                Nothing is hidden.
              </p>
            )}
            {hidden.items.map((comment) => (
              <CommentItem
                key={comment.id}
                videoId={videoId}
                signedIn={signedIn}
                comment={comment}
                canEdit={commentsEnabled}
                onChanged={(changed) =>
                  hidden.setItems((current) => current.map((item) => (item.id === changed.id ? changed : item)))
                }
                onDeleted={() => {
                  hidden.setItems((current) => current.filter((item) => item.id !== comment.id));
                  hidden.setTotal((current) => current - 1);
                  router.refresh();
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => unhide(comment)}>
                    Unhide
                  </Button>
                  {comment.parentId && <span className="text-sm text-muted-foreground">This is a reply.</span>}
                </div>
              </CommentItem>
            ))}
            {hidden.hasMore && (
              <LoadMore loading={hidden.loading} onClick={() => hidden.load()}>
                Load more hidden comments
              </LoadMore>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        comments
      )}
    </section>
  );
}
