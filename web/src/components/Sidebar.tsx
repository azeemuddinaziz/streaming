import { NavLink } from "react-router-dom";
import { History, Home, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { getSubscriptionList } from "@/services/subscription.services";
import { toast } from "sonner";

function Sidebar() {
  const { isAuthenticated, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const getData = async () => {
        setIsLoading(true);
        //@ts-ignore
        const response = await getSubscriptionList(user._id);
        setSubscriptions(response);
        setIsLoading(false);
      };

      getData();
    } catch (error) {
      setIsLoading(false);
      //@ts-ignore
      toast("Error in sidebar data", error);
    }
  }, [user]);

  return (
    <div className="block border border-t-0 h-full">
      <div className="flex flex-col gap-2 p-2">
        <NavLink to={"/"}>
          {({ isActive }) => (
            <Button
              className={`flex items-center justify-start gap-4 w-full py-2 h-full}`}
              variant={isActive ? "secondary" : "ghost"}
            >
              <Home className="h-5 w-5" />
              <span className="hidden md:block text-md font-normal">Home</span>
            </Button>
          )}
        </NavLink>

        <NavLink to={"/history"}>
          {({ isActive }) => (
            <Button
              className="flex items-center justify-start gap-4 w-full py-2 h-full"
              variant={isActive ? "secondary" : "ghost"}
            >
              <History className="h-5 w-5" />
              <span className="hidden md:block text-md font-normal">
                History
              </span>
            </Button>
          )}
        </NavLink>

        <NavLink to={"/subscriptions"}>
          {({ isActive }) => (
            <Button
              className="flex items-center justify-start gap-4 w-fitw-full py-2 h-full"
              variant={isActive ? "secondary" : "ghost"}
            >
              <ListVideo className="h-5 w-5" />
              <span className="hidden md:block text-md font-normal">
                Subscripitons
              </span>
            </Button>
          )}
        </NavLink>
      </div>

      <Separator />

      <div className="md:flex flex-col gap-2 p-2">
        <h4 className="hidden md:block text-base font-bold  px-2 py-2">
          Subscriptions
        </h4>
        {isAuthenticated && (
          <div className="flex flex-col gap-2">
            {isLoading && subscriptions.length <= 0 && <div>Loading</div>}

            {subscriptions.length === 0 && (
              <Button className="hidden md:block" disabled variant={"outline"}>
                You have no subscriptions yet.
              </Button>
            )}

            {!isLoading &&
              subscriptions.length > 0 &&
              subscriptions.map(({ channel }) => (
                <NavLink
                  //@ts-ignore
                  to={`/profile/${channel.username}`}
                  //@ts-ignore
                  key={channel._id}
                  //@ts-ignore
                  className={({ isActive }) =>
                    isActive && "bg-secondary rounded-md"
                  }
                >
                  <Button
                    className="flex items-center justify-start gap-4 w-full md:py-2 h-full"
                    variant={"ghost"}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={
                          //@ts-ignore
                          channel.avatar
                        }
                      />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block text-md font-normal overflow-hidden text-ellipsis">
                      {
                        //@ts-ignore
                        channel.username
                      }
                    </span>
                  </Button>
                </NavLink>
              ))}
          </div>
        )}

        {!isAuthenticated && (
          <NavLink className={"hidden md:block"} to={"login/"}>
            <Button variant={"outline"}>
              <span className=" text-md font-normal overflow-hidden text-ellipsis">
                Login to view subscriptions
              </span>
            </Button>
          </NavLink>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
