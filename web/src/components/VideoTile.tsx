import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { EllipsisVertical } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { addVideoToPlaylist } from "@/services/playlist.services";
import { toast } from "sonner";

type VideoTileProps = {
  title: string;
  thumbnail: string;
  username: string;
  views: number;
  id: string;
  avatar: string;
  playlistArray?: Array<string>;
};

function VideoTile({
  title,
  thumbnail,
  username,
  views,
  id,
  avatar,
  playlistArray,
}: VideoTileProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCardClick = () => {
    navigate(`/search/${id}`);
  };

  const addPlaylistVideo = async (playlistId: string, videoId: string) => {
    try {
      const data = await addVideoToPlaylist(playlistId, videoId);
      if (!data) throw "Failed to add video to playlist";

      toast("Video added to playlist.");
    } catch (error) {
      //@ts-ignore
      toast("Error:", error);
      return error;
    }
  };

  return (
    <>
      <Card
        onClick={handleCardClick}
        className="overflow-hidden cursor-pointer"
      >
        <CardContent className="p-0 w-full">
          <img
            alt="Video thumbnail"
            className="aspect-video object-cover w-full"
            height="180"
            src={thumbnail}
            width="320"
          />
        </CardContent>
        <CardFooter className="flex items-start p-4">
          <div className="flex flex-col items-start gap-2 w-full">
            <h3 className="font-semibold">{title}</h3>
            <Link
              to={`/profile/${username}`}
              className="flex items-center justify-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={avatar} />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground h-fit w-full hover:text-primary">
                {username}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">{views} • Views</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant={"ghost"}
                size={"icon"}
                className="rounded-full"
                asChild
              >
                <EllipsisVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mt-[-8px] z-999">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${username}`);
                }}
              >
                View profile
              </DropdownMenuItem>

              {isAuthenticated && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <span>Add to playlist</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <ScrollArea>
                        <Card className="max-h-40">
                          {!playlistArray && (
                            <DropdownMenuItem>
                              <Button disabled variant={"ghost"} size="sm">
                                No playlists
                              </Button>
                            </DropdownMenuItem>
                          )}

                          {
                            //@ts-ignore
                            playlistArray?.length > 0 &&
                              playlistArray?.map((playlist, index) => {
                                return (
                                  <DropdownMenuItem
                                    key={index}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      //@ts-ignore
                                      addPlaylistVideo(playlist._id, id);
                                    }}
                                  >
                                    <span>
                                      {
                                        //@ts-ignore
                                        playlist.name
                                      }
                                    </span>
                                  </DropdownMenuItem>
                                );
                              })
                          }
                        </Card>
                      </ScrollArea>
                      {/* 
                      TODO: make this thing working.
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Create new playlist</span>
                      </DropdownMenuItem> */}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </>
  );
}

export default VideoTile;
