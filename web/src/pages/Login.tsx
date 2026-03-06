import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { loginUser } from "@/services/user.services";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface FormData {
  username?: string;
  password?: string;
}

function Login() {
  const { isAuthenticated, setIsAuthenticated, setUser } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    username: "Guest",
    password: "Guest",
  });
  const [error, setError] = useState<any>();

  if (isAuthenticated) {
    setTimeout(() => {
      navigate("/");
    }, 5000);

    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>LoggedIn Successfully!</CardTitle>
            <CardDescription>
              You will now be redirected to home page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/" className="w-full">
              <Button className="flex items-center gap-2 w-full">
                <span>Click Here</span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const { username, password } = formData;

      if (!username || !password) {
        throw new Error("Username and password are required");
      }

      const data = await loginUser(username, password);

      if (!data) return "Data not found";
      if (data === 404) throw "User not found";
      if (data === 500) throw "Password is incorrect";

      setUser(data);
      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (error) {
      setIsAuthenticated(false);
      setIsLoading(false);
      setError(error);
      return error;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <Card>
        {error && (
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Fill the form to login.</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid  grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={handleFormSubmit}
          >
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                type="text"
                id="username"
                placeholder="Username"
                value={"Guest"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, username: e.target.value })
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
                value={"Guest"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full items-center gap-1.5 md:col-span-2">
              <Button>
                {!isLoading && (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Login</span>
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
          <span className="text-muted-foreground">Do not have an account?</span>
          <Link to="/register" className="underline hover:text-ring">
            Register here
          </Link>
        </CardFooter>

{/*         <Button
          className="w-full m-2 "
          variant={"outline"}
          onClick={() => {
            setUser({ username: "Guest", password: "Guest" });
            setIsAuthenticated(true);
          }}
        >
          Login as Guest
        </Button> */}
      </Card>
    </div>
  );
}

export default Login;
