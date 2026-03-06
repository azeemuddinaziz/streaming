import { Link, useNavigate } from "react-router-dom";
import { Search, Upload, User } from "lucide-react";
import lightLogo from "@/assets/light-logo.svg";
import darkLogo from "@/assets/dark-logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider.tsx";
import { ModeToggle } from "@/components/ModeToggle";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState } from "react";

interface HeaderPropsType {
  isSimple: Boolean;
}

function Header({ isSimple }: HeaderPropsType) {
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const [search, setSearch] = useState();
  const navigate = useNavigate();

  const handleSearch = () => {
    if (search === undefined) {
      navigate(`/`);
      return;
    }
    navigate(`/results?query=${search}`);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 md:px-10 md:py-4 border-b ">
      <Link to={"/"}>
        <div className="flex items-center gap-2">
          {theme == "dark" ? (
            <img src={darkLogo} alt="logo of streamsouk" width={30} />
          ) : (
            <img src={lightLogo} alt="logo of streamsouk" width={30} />
          )}
          <span className="text-xl font-bold">StreamSouk</span>
        </div>
      </Link>

      <div className="md:flex w-full max-w-sm items-center space-x-2 hidden">
        <Input
          type="text"
          placeholder="Search"
          className="focus-visible:ring-transparent focus-visible:border-primary"
          //@ts-ignore
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Button
          type="submit"
          variant={"outline"}
          onClick={() => handleSearch()}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {isAuthenticated && (
          <Link to={`/upload`}>
            <Button variant={"outline"} size={"icon"}>
              <Upload className="w-5 h-5" />
            </Button>
          </Link>
        )}

        <ModeToggle />

        {!isSimple && !isAuthenticated && (
          <Link to={"/login"}>
            <Button variant={"outline"}>Login</Button>
          </Link>
        )}

        {isAuthenticated && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <User />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>

              <DropdownMenuSeparator />

              <Link
                //@ts-ignore
                to={`/profile/${user.username}`}
              >
                <DropdownMenuItem>Profile</DropdownMenuItem>
              </Link>

              <Link to="/logout">
                <DropdownMenuItem>Log Out</DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default Header;
