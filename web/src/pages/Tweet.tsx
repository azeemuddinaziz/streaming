import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createTweet,
  deleteTweet,
  getTweetsByUserId,
  updateTweet,
} from "@/services/tweet.services";
import { AlertCircle, CheckCheck, Edit2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  isOwner?: boolean;
  userId?: string;
};

function Tweet({ isOwner, userId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [tweets, setTweets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tweetContent, setTweetContent] = useState("");
  const [editMode, setEditMode] = useState<string | null>(null); // Track which tweet is in edit mode
  const [editContentValue, setEditContentValue] = useState<string | null>(null); // Track edit content value
  const navigate = useNavigate();

  useEffect(() => {
    setError(null);
    setIsLoading(true);

    const getTweets = async () => {
      try {
        //@ts-ignore
        const data = await getTweetsByUserId(userId);
        setTweets(data.reverse());
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    getTweets();
  }, [userId]);

  const handleSubmitTweet = async () => {
    try {
      setIsLoading(true);
      await createTweet(tweetContent);
      setTweetContent("");
      navigate(0);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTweet = async (tweetId: string) => {
    try {
      setIsLoading(true);
      await deleteTweet(tweetId);
      navigate(0);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTweet = async (tweetId: string) => {
    try {
      setIsLoading(true);
      await updateTweet(editContentValue!, tweetId); // Ensure editContentValue is not null
      setEditMode(null);
      setEditContentValue(null);
      navigate(0);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isOwner && (
        <Card className="p-5 bg-secondary">
          <div className="flex gap-4 items-stretch h-24">
            <Textarea
              placeholder="Enter your text here.."
              className="flex-1 h-full resize-none"
              value={tweetContent}
              onChange={(e) => setTweetContent(e.target.value)}
            />
            {!isLoading ? (
              <Button className="w-1/12 h-full" onClick={handleSubmitTweet}>
                Post
              </Button>
            ) : (
              <Button disabled className="w-1/12 h-full">
                <Loader2 className="h-10 w-10 animate-spin" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!tweets && isLoading && <Loader2 className="animate-spin" />}

      {!isLoading &&
        tweets.map((tweet) => {
          return (
            <Card
              key={tweet._id}
              className="flex gap-4items-center justify-between p-6"
            >
              <CardContent className="w-full p-0">
                {editMode === tweet._id ? (
                  <Textarea
                    value={editContentValue ?? tweet.content}
                    onChange={(e) => setEditContentValue(e.target.value)}
                  />
                ) : (
                  <span>{tweet.content}</span>
                )}
              </CardContent>
              {isOwner && (
                <CardFooter className="flex items-center gap-2 p-0 cursor-pointer">
                  {editMode === tweet._id ? (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => handleUpdateTweet(tweet._id)}
                      >
                        <CheckCheck className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => {
                        setEditContentValue(tweet.content);
                        setEditMode(tweet._id);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteTweet(tweet._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
    </div>
  );
}

export default Tweet;
