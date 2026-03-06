import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import {
  changeAvatar,
  changeCoverImage,
  getChannelByChannelName,
} from "@/services/user.services";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toggleSubscription } from "@/services/subscription.services";
import Home from "./Home";
import { useAuth } from "@/context/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Edit, Loader2, PlusCircle } from "lucide-react";
import Tweet from "./Tweet";
import Playlist from "./Playlist";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const { username } = useParams();
  const [profile, setProfile] = useState();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [changeData, setChangeData] = useState({});

  //@ts-ignore
  useEffect(() => {
    try {
      const getData = async () => {
        //@ts-ignore
        const data = await getChannelByChannelName(username);
        setProfile(data);
      };
      getData();
    } catch (error) {
      return error;
    }
  }, [username]);

  if (!profile) return <div>Loading...</div>;

  const handleSubscribeClick = async () => {
    try {
      //@ts-ignore
      await toggleSubscription(profile._id);
      //@ts-ignore
      setProfile({ ...profile, isSubscribed: !profile.isSubscribed });
    } catch (error) {
      return error;
    }
  };

  const handleEditSave = async () => {
    setIsLoading(true);

    try {
      //@ts-ignore
      if (changeData?.avatar) {
        //@ts-ignore
        const data = await changeAvatar(changeData.avatar);
        if (!data) throw "Error while updating avatar";
      }

      //@ts-ignore
      if (changeData?.coverImage) {
        //@ts-ignore
        const data = await changeCoverImage(changeData.coverImage);
        if (!data) throw "Error while updating coverImage";
      }

      setIsLoading(false);
      setIsEditMode(false);
      navigate(0);
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      toast("Error editing: ", error);
    }
  };

  if (isLoading)
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="opacity-50 animate-spin" size={200} />
      </div>
    );

  return (
    <ScrollArea>
      <Card className="p-0">
        <CardHeader className="flex flex-col gap-4 p-0 md:p-4">
          <div
            className={`h-fit md:h-48 ${
              isEditMode && "relative flex items-center justify-center"
            }`}
          >
            {isEditMode && (
              <div className="absolute w-full h-full bg-black/80 flex items-center justify-center">
                <Button size={"icon"}>
                  <Edit />
                  <input
                    type="file"
                    className="absolute opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={(e) =>
                      setChangeData({
                        ...changeData,
                        //@ts-ignore
                        coverImage: e.target.files[0],
                      })
                    }
                  />
                </Button>
              </div>
            )}
            <img
              //@ts-ignore
              src={profile.coverImage}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center px-4 py-2 md:py-0 gap-4 md:gap-0">
            <div className="flex gap-4 items-center justify-between">
              <div className="relative w-full md:w-1/6 rounded-full overflow-hidden flex items-center justify-center">
                {isEditMode && (
                  <div className="absolute w-full h-full rounded-full bg-black/80 flex items-center justify-center">
                    <Button size={"icon"}>
                      <Edit />
                      <input
                        type="file"
                        className="absolute opacity-0 cursor-pointer"
                        accept="image/*"
                        onChange={(e) =>
                          setChangeData({
                            ...changeData,
                            //@ts-ignore
                            avatar: e.target.files[0],
                          })
                        }
                      />
                    </Button>
                  </div>
                )}
                <img
                  //@ts-ignore
                  src={profile.avatar}
                  //@ts-ignore
                  alt={profile.username.slice(0, 2).toUpperCase()}
                  className="overflow-hidden"
                />
              </div>
              <div className="flex flex-col gap-2 w-full">
                <CardTitle className="text-lg">
                  {
                    //@ts-ignore
                    profile.fullname
                  }
                </CardTitle>
                <CardDescription className="text-sm">
                  @
                  {
                    //@ts-ignore
                    profile.username
                  }
                </CardDescription>
                <CardDescription className="text-sm">
                  {
                    //@ts-ignore
                    profile.subscribersCount
                  }
                  <span> • Subscribers</span>
                </CardDescription>
              </div>
            </div>

            {
              //@ts-ignore
              profile.isSubscribed ? (
                <Button
                  onClick={() => handleSubscribeClick()}
                  variant={"secondary"}
                  className="w-full md:w-fit"
                >
                  Subscribed
                </Button>
              ) : //@ts-ignore
              user.username !== username ? (
                <Button onClick={() => handleSubscribeClick()}>
                  Subscribe
                </Button>
              ) : !isEditMode ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate("/change-password")}
                    variant={"destructive"}
                  >
                    Change Password
                  </Button>
                  <Button onClick={() => setIsEditMode(true)}>
                    Edit Profile
                  </Button>
                </div>
              ) : (
                isEditMode && (
                  <Button
                    onClick={() => handleEditSave()}
                    variant={"destructive"}
                  >
                    Save Changes
                  </Button>
                )
              )
            }
          </div>
        </CardHeader>

        <CardContent className="w-full p-0 md:p-4">
          <Tabs defaultValue="videos" className="w-full">
            <TabsList className="w-full rounded-none">
              <TabsTrigger className="w-full" value="videos">
                Videos
              </TabsTrigger>
              <TabsTrigger className="w-full" value="playlist">
                Playlist
              </TabsTrigger>
              <TabsTrigger className="w-full" value="tweets">
                Tweets
              </TabsTrigger>
              <TabsTrigger className="w-full" value="about">
                About
              </TabsTrigger>
            </TabsList>
            <TabsContent value="videos">
              {
                //@ts-ignore
                user.username === profile.username && (
                  <Link to={"/upload"}>
                    <Button
                      variant={"default"}
                      className="flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Upload Video
                    </Button>
                  </Link>
                )
              }
              <Home
                query={
                  //@ts-ignore
                  profile._id
                }
              />
            </TabsContent>

            <TabsContent value="playlist">
              <Playlist
                //@ts-ignore
                userId={profile._id}
                username={username}
                //@ts-ignore
                isOwner={user.username === username}
              />
            </TabsContent>

            <TabsContent value="tweets">
              <Tweet
                userId={
                  //@ts-ignore
                  profile._id
                }
                isOwner={
                  //@ts-ignore
                  user.username === username
                }
              />
            </TabsContent>

            <TabsContent value="about">
              <Card>
                <CardHeader>
                  <span>
                    Mail id:
                    {
                      //@ts-ignore
                      profile?.email
                    }
                  </span>
                  <span>
                    Created at:
                    {
                      //@ts-ignore
                      profile?.createdAt.split("T")[0]
                    }
                  </span>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ScrollArea>
  );
}
