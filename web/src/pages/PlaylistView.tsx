import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VideoTile from "@/components/VideoTile";
import { useAuth } from "@/context/AuthContext";
import {
  getPlaylistById,
  removeVideoFromPlaylist,
  updatePlaylistDetails,
} from "@/services/playlist.services";
import {
  AlertCircle,
  CheckCheck,
  Edit2Icon,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function PlaylistView() {
  const [isLoading, setIsLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState({});
  const [error, setError] = useState(null);
  const { username, playlistId } = useParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [updatedData, setUpdatedData] = useState({});
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    //@ts-ignore
    setIsOwner(user.username === username);
    const getPlaylistData = async () => {
      try {
        setIsLoading(true);
        //@ts-ignore
        const data = await getPlaylistById(playlistId);
        if (!data) throw "Failed to load playlist data";

        setPlaylistData(data);
        //@ts-ignore
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        //@ts-ignore
        setError(error);
        return error;
      }
    };

    getPlaylistData();
  }, []);

  const handleUpdate = async () => {
    setError(null);
    setIsLoading(true);

    try {
      //@ts-ignore
      const { name, description } = updatedData;

      if (name === undefined && description === undefined) {
        setIsLoading(false);
        setIsEditMode(false);
        return;
      }

      //@ts-ignore
      const data = await updatePlaylistDetails(name, description, playlistId);
      if (!data) throw "Error while updating avatar";

      setIsLoading(false);
      setIsEditMode(false);
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      setError(error);
    }
  };

  const handleRemoveVideoFromPlaylist = async (videoId: string) => {
    setError(null);
    setIsLoading(true);

    try {
      //@ts-ignore
      const data = await removeVideoFromPlaylist(playlistId, videoId);
      if (!data) throw "Error while updating avatar";

      setIsLoading(false);
      setIsEditMode(false);
      navigate(0);
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      setError(error);
    }
  };

  if (error !== null) {
    return (
      <Alert variant="destructive" className="h-fit w-fit">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="w-48 h-48 opacity-10 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <span>Playlist Name: </span>
          {!isEditMode ? (
            <span>
              {
                //@ts-ignore
                playlistData.name
              }
            </span>
          ) : (
            <div>
              <Input
                type="text"
                //@ts-ignore
                defaultValue={playlistData.name}
                onChange={(e) =>
                  setUpdatedData({
                    ...updatedData,
                    name: e.target.value,
                  })
                }
              />
            </div>
          )}
          {isOwner &&
            (!isEditMode ? (
              <Button
                variant={"ghost"}
                size={"icon"}
                onClick={() => {
                  setIsEditMode(true);
                }}
              >
                <Edit2Icon className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant={"outline"}
                  size={"icon"}
                  onClick={() => handleUpdate()}
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>

                <Button
                  variant={"destructive"}
                  size={"icon"}
                  onClick={() => {
                    setIsEditMode(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ))}
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <span>Description: </span>
          {!isEditMode ? (
            <span>
              {
                //@ts-ignore
                playlistData.description
              }
            </span>
          ) : (
            <div>
              <Textarea
                //@ts-ignore
                defaultValue={playlistData.description}
                onChange={(e) =>
                  setUpdatedData({
                    ...updatedData,
                    descripiton: e.target.value,
                  })
                }
              />
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <div className="grid grid-cols-4 gap-6 px-6 w-full ">
        {
          //@ts-ignore
          playlistData?.videos?.length > 0 ? (
            //@ts-ignore
            playlistData?.videos?.map((video, index) => {
              return (
                <div className="relative h-fit">
                  {isOwner && (
                    <Button
                      className="absolute bottom-4 right-4"
                      variant={"destructive"}
                      size={"icon"}
                      onClick={() => handleRemoveVideoFromPlaylist(video._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <VideoTile
                    key={index}
                    title={video.title}
                    thumbnail={video.thumbnail}
                    id={video._id}
                    username={video.owner.username}
                    avatar={video.owner.avatar}
                    views={video.views}
                  />
                </div>
              );
            })
          ) : (
            <div>
              <div className="text-gray-500">
                Something went wrong while loading videos. {error}
              </div>
            </div>
          )
        }
      </div>
    </Card>
  );
}

export default PlaylistView;
