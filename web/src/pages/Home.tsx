import { ScrollArea } from "@/components/ui/scroll-area";
import VideoTile from "@/components/VideoTile.tsx";
import { useAuth } from "@/context/AuthContext";
import { getUserPlaylist } from "@/services/playlist.services";
import { getAllVideos } from "@/services/video.services.ts";
import { useEffect, useState } from "react";

type Video = {
  thumbnail: string;
  title: string;
  username: string;
  views: number;
  _id: string;
};

type Props = {
  className?: string;
  query?: string;
};

function Home({ className, query }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState();
  const [userPlaylist, setUserPlaylist] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    try {
      //@ts-ignore
      setError(null);
      (async () => {
        //@ts-ignore
        setUserPlaylist(await getUserPlaylist(user._id));
      })();

      (async () => {
        setVideos(await getAllVideos(query || ""));
      })();
    } catch (error) {
      //@ts-ignore
      setError(error);
    }
  }, [user, query]);

  if (error) {
    return <div>Error occured while loading videos: {error}</div>;
  }

  return (
    <ScrollArea>
      <div className={`grid md:grid-cols-4 gap-4 p-4 w-full ${className}`}>
        {videos.length === 0 && (
          <div className="text-muted-foreground">No videos found!</div>
        )}

        {videos.length > 0 &&
          videos.map((video) => {
            return (
              <VideoTile
                key={video._id}
                title={video.title}
                thumbnail={video.thumbnail}
                //@ts-ignore
                username={video.ownerDetails.username}
                //@ts-ignore
                avatar={video.ownerDetails.avatar}
                views={video.views}
                id={video._id}
                playlistArray={userPlaylist}
              />
            );
          })}
      </div>
    </ScrollArea>
  );
}

export default Home;
