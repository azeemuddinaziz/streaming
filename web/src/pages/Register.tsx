import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { registerUser } from "@/services/user.services";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface FormData {
  fullname?: string;
  username?: string;
  email?: string;
  password?: string;
  avatar?: File | null;
  coverImage?: File | null;
}

function Register() {
  const { isAuthenticated } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, SetIsLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>();

  if (isAuthenticated) {
    setTimeout(() => {
      navigate("/");
    }, 0);
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    setIsRegistered(false);
    SetIsLoading(true);

    e.preventDefault();
    // @ts-ignore
    const { fullname, username, email, password, avatar, coverImage } =
      formData;

    try {
      const data = await registerUser(
        fullname,
        username,
        email,
        password,
        avatar,
        coverImage
      );
      if (!data) return "Server did not respond.";

      SetIsLoading(false);
      setIsRegistered(true);
    } catch (error) {
      setIsRegistered(false);
      SetIsLoading(false);
      return error;
    }
  };

  if (isRegistered) {
    const redirectToLogin = () => {
      setTimeout(() => {
        navigate("/login");
      }, 5000);
    };
    redirectToLogin();

    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Registered Successfully!</CardTitle>
            <CardDescription>
              You will now be redirected to login page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/login" className="w-full">
              <Button className="flex items-center gap-2 w-full">
                <span>Click Here</span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Please fill the form to register</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="flex flex-col sm:grid gap-4"
            onSubmit={handleFormSubmit}
          >
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="fullname">Full Name</Label>
              <Input
                type="text"
                id="fullname"
                placeholder="Full Name"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, fullname: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                type="text"
                id="username"
                placeholder="Username"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                placeholder="Email"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                placeholder="Password"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="avatar">Avatar</Label>
              <Input
                type="file"
                id="avatar"
                placeholder="avatar"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  // @ts-ignore
                  setFormData({ ...formData, avatar: e.target.files[0] })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="coverImage">CoverImage</Label>
              <Input
                type="file"
                id="coverImage"
                placeholder="coverImage"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  // @ts-ignore
                  setFormData({ ...formData, coverImage: e.target.files[0] })
                }
              />
            </div>

            <div className="grid w-full items-center gap-1.5 col-span-2">
              <Button>
                {!isLoading && (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Register</span>
                  </>
                )}

                {isLoading && (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Please Wait</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex items-center gap-1">
          <span className="text-muted-foreground">
            Already have an account?
          </span>
          <Link to="/login" className="hover:underline hover:text-ring">
            Login here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default Register;
