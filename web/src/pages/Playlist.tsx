import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createPlaylist,
  deletePlaylist,
  getUserPlaylist,
} from "@/services/playlist.services";
import { DialogClose } from "@radix-ui/react-dialog";
import {
  AlertCircle,
  CirclePlus,
  ListVideo,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Props = {
  userId?: string;
  isOwner?: boolean;
  username?: string;
};

export default function Playlist({ userId, isOwner, username }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [isPlaylistCreated, setIsPlaylistCreated] = useState(false);
  const navigate = useNavigate();
  const [playlistArray, setPlaylistArray] = useState([]);

  useEffect(() => {
    const getPlaylists = async () => {
      setIsLoading(true);
      try {
        //@ts-ignore
        const data = await getUserPlaylist(userId);
        if (!data) throw "Failed to load playlists";

        setPlaylistArray(data);
        //@ts-ignore
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        //@ts-ignore
        setError(error);
        return error;
      }
    };

    getPlaylists();
  }, []);

  const handleCreate = async () => {
    setIsLoading(true);
    setIsPlaylistCreated(false);
    try {
      // @ts-ignore
      const { name, description } = formData;

      const data = await createPlaylist(name, description);
      if (!data) throw "Failed to create playlist";

      //@ts-ignore
      setIsPlaylistCreated(true);
      setIsLoading(false);
      setTimeout(() => {
        navigate(0);
      }, 5000);
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      setError(error);
      return error;
    }
  };

  const handleOpenPlaylist = (username: string, playlistId: string) => {
    navigate(`/playlist/${username}/${playlistId}`);
  };

  const handleRemovePlaylist = async (playlistId: string) => {
    try {
      setError(null);
      await deletePlaylist(playlistId);
      toast("Playlist deleted successfully, please refresh page.");
    } catch (error) {
      //@ts-ignore
      setError(error);
      return error;
    }
  };
  return (
    <>
      {isOwner && (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="my-4">
              <CirclePlus className="mr-1 w-5 h-5" />
              New Playlist
            </Button>
          </DialogTrigger>

          {isPlaylistCreated ? (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Playlist created succesfully</DialogTitle>
                <DialogDescription>You now may close this.</DialogDescription>
                <DialogClose />
              </DialogHeader>
            </DialogContent>
          ) : (
            <DialogContent>
              {error !== null && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogHeader>
                <DialogTitle>Create new playlist</DialogTitle>
                <DialogDescription>
                  Add playlist name and description. Click create when you're
                  done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Vibe Vibe [Charecter limit: 50 charecters]"
                    className="col-span-3"
                    maxLength={50}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Songs to vibe on, while playing chess.... [Charecter limit: 256 charecters]"
                    className="col-span-3"
                    maxLength={256}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                {!isLoading ? (
                  <Button type="submit" onClick={() => handleCreate()}>
                    Create
                  </Button>
                ) : (
                  <Button disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      )}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {playlistArray.map((playlist, index) => {
          return (
            <Card
              key={index}
              className="px-4 py-6 cursor-pointer hover:bg-primary-foreground"
              //@ts-ignore
              onClick={() => handleOpenPlaylist(username, playlist._id)}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4 p-0">
                <div className="flex items-center gap-4 ">
                  <ListVideo className="w-6 h-6" />
                  <div>
                    <CardTitle>
                      {
                        //@ts-ignore
                        playlist.name
                      }
                    </CardTitle>
                    <CardDescription>
                      {
                        //@ts-ignore
                        playlist.description
                      }
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant={"destructive"}
                  size={"icon"}
                  onClick={(e) => {
                    e.stopPropagation();
                    //@ts-ignore
                    handleRemovePlaylist(playlist._id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </>
  );
}
