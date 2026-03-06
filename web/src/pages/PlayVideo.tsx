import { getVideoById } from "@/services/video.services";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCheck, Edit2, Loader2, ThumbsUp, Trash2, X } from "lucide-react";
import Home from "./Home";
import { toast } from "sonner";
import { toggleLikeVideo } from "@/services/like.services";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import {
  addCommentToVideo,
  deleteComment,
  getVideoComments,
  updateComment,
} from "@/services/comment.services";
import { useAuth } from "@/context/AuthContext";

function PlayVideo() {
  const [video, setVideo] = useState({});
  const { videoId } = useParams();
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      //@ts-ignore
      setVideo(await getVideoById(videoId));
      //@ts-ignore
      setComments(await getVideoComments(videoId));
      //@ts-ignore
      setIsLiked(video.isLiked);
    })();
    setLoading(false);
  }, [isLiked]);

  const handleRemoveComment = async (commentId: string) => {
    setIsLoading(true);
    try {
      await deleteComment(commentId);

      toast("Comment removed successfully, please refresh the page.");

      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      toast("Error", error);
    }
  };

  const handlePostComment = async () => {
    try {
      if (commentContent === "" || !commentContent) {
        throw "Comment cannot be empty.";
      }

      //@ts-ignore
      const data = await addCommentToVideo(videoId, commentContent);

      setCommentContent("");
      //@ts-ignore
      toast("Comment posted successfully. Please refresh the page.");
    } catch (error) {
      //@ts-ignore
      toast("Error while posting comment: ", error);
    }
  };

  const handleEditContent = async (commentId: string) => {
    try {
      if (commentContent === "" || !commentContent) {
        throw "Comment cannot be empty.";
      }

      await updateComment(commentId, commentContent);

      setCommentContent("");
      setIsEditMode(false);
      toast("Comment updated successfully, please refresh the page.");
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      toast("Error while editing the comment. ", error);
    }
  };

  const handleToggleLike = () => {
    try {
      (async () => {
        //@ts-ignore
        await toggleLikeVideo(videoId);
        setIsLiked(!isLiked);
        isLiked
          ? toast("Like removed from the video.")
          : toast("Like added to the video.");
      })();
    } catch (error) {
      setIsLiked(isLiked);
      //@ts-ignore
      toast("Error: " + error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ScrollArea className="overflow-y-scroll">
      <div className="md:grid grid-cols-[minmax(900px,_1fr)_280px]  w-full overflow-hidden">
        <Card className="w-full">
          <CardContent className="p-0">
            <div className="aspect-video w-full bg-black">
              <video
                className="w-full h-full"
                controls
                //@ts-ignore
                poster={video.thumbnail}
                //@ts-ignore
                src={video.videoFile}
              ></video>
            </div>
          </CardContent>
          <CardHeader className="flex md:flex-row md:justify-between md:items-center gap-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="flex flex-col gap-2 text-md md:text-2xl font-bold">
                {
                  //@ts-ignore
                  video.title
                }
              </CardTitle>
              <CardDescription className="flex flex-row items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Avatar className="w-8 h-8">
                    <AvatarImage
                      src={
                        //@ts-ignore
                        video.owner?.avatar
                      }
                      alt="Channel avatar"
                    />
                    <AvatarFallback>CH</AvatarFallback>
                  </Avatar>
                  <Link
                    className="hover:text-secondary-foreground"
                    to={`/profile/${
                      //@ts-ignore
                      video.owner?.username
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {
                        //@ts-ignore
                        video.owner?.username
                      }
                    </span>
                  </Link>
                </div>
              </CardDescription>
            </div>

            <Button
              variant={isLiked ? "default" : "secondary"}
              size="sm"
              onClick={handleToggleLike}
              className="flex gap-2 items-center"
            >
              <ThumbsUp className="md:mr-2 h-4 w-4" />
              <span>{!isLiked ? "Like Video" : "Remove Like"}</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col bg-muted p-4 rounded-lg">
              <span className="text-sm font-medium mb-2">
                {
                  //@ts-ignore
                  video.views
                }
                <span> • Views</span>
              </span>
              <span
                className={`text-sm truncate  ${
                  showFull ? "h-full" : "max-h-40"
                }`}
              >
                <pre>
                  {
                    //@ts-ignore
                    video.description
                  }
                </pre>
              </span>
              {!showFull ? (
                <span
                  className="hover:underline cursor-pointer pt-4"
                  onClick={() => setShowFull(true)}
                >
                  Show more
                </span>
              ) : (
                <span
                  className="hover:underline cursor-pointer pt-4"
                  onClick={() => setShowFull(false)}
                >
                  Show less
                </span>
              )}
            </div>
          </CardContent>

          <Card className="m-2">
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    placeholder="Post a comment.."
                    onChange={(e) => setCommentContent(e.target.value)}
                  />
                  <Button onClick={() => handlePostComment()}>Post</Button>
                </div>
              </div>
            </CardContent>

            <CardContent>
              <div>
                <div className="space-y-6">
                  {comments.length == 0 && (
                    <div>No comments on the video yet.</div>
                  )}

                  {comments.length > 0 &&
                    comments.map((comment) => {
                      return (
                        <div
                          key={
                            //@ts-ignore
                            comment._id
                          }
                          className="flex space-x-4 p-2 border-b pb-6"
                        >
                          <Avatar>
                            <AvatarImage
                              src={
                                //@ts-ignore
                                comment.owner.avatar
                              }
                              alt={
                                //@ts-ignore
                                comment.owner.username
                              }
                            />
                            <AvatarFallback>
                              {
                                //@ts-ignore
                                comment.owner.username.charAt(0)
                              }
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-grow">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold">
                                {
                                  //@ts-ignore
                                  comment.owner.username
                                }
                              </span>
                            </div>
                            {!isEditMode && (
                              <p className="mt-1">
                                {
                                  //@ts-ignore
                                  comment.content
                                }
                              </p>
                            )}

                            {isEditMode && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  //@ts-ignore
                                  defaultValue={comment.content}
                                  onChange={(e) =>
                                    setCommentContent(e.target.value)
                                  }
                                />
                                <Button
                                  size={"icon"}
                                  onClick={
                                    //@ts-ignore
                                    () => handleEditContent(comment._id)
                                  }
                                >
                                  <CheckCheck className="w-4 h-4" />
                                </Button>
                                <Button
                                  size={"icon"}
                                  variant={"outline"}
                                  onClick={() => setIsEditMode(false)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {
                            //@ts-ignore
                            comment.owner.username === user.username &&
                              !isEditMode && (
                                <div className="flex items-center space-x-4 mt-2">
                                  <Button
                                    size={"icon"}
                                    variant={"ghost"}
                                    onClick={() => setIsEditMode(true)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )
                          }

                          {
                            //@ts-ignore
                            user.username === video.owner.username &&
                              !isEditMode && (
                                <div className="flex items-center space-x-4 mt-2">
                                  {!isLoading ? (
                                    <Button
                                      size={"icon"}
                                      variant={"destructive"}
                                      onClick={() =>
                                        //@ts-ignores
                                        handleRemoveComment(comment._id)
                                      }
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button size={"icon"} disabled>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    </Button>
                                  )}
                                </div>
                              )
                          }
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </Card>
        <Home className={"hidden md:grid md:grid-cols-none overflow-hidden"} />
      </div>
    </ScrollArea>
  );
}
export default PlayVideo;
