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
import { changePassword } from "@/services/user.services";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface FormData {
  oldPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

function Register() {
  const [isPasswordChanged, setIsPasswordChange] = useState(false);
  const [isLoading, SetIsLoading] = useState(false);
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState<FormData>();

  const handleFormSubmit = async (e: React.FormEvent) => {
    SetIsLoading(true);
    setIsPasswordChange(false);
    setError(null);

    e.preventDefault();
    // @ts-ignore
    const { oldPassword, newPassword, confirmNewPassword } = formData;

    try {
      if (newPassword !== confirmNewPassword) {
        throw "New Password did not matched.";
      }

      const data = await changePassword(oldPassword, newPassword);
      if (!data) throw "Server did not respond.";

      if (data.status === 401) throw "Invalid current password";

      setError(null);
      setIsPasswordChange(true);
      SetIsLoading(false);
    } catch (error) {
      //@ts-ignore

      setError(error);
      setIsPasswordChange(false);
      SetIsLoading(false);
      return error;
    }
  };

  if (isPasswordChanged) {
    const redirectToHome = () => {
      setTimeout(() => {
        navigate("/");
      }, 5000);
    };
    redirectToHome();

    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Password changed Successfully!</CardTitle>
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

  return (
    <div className="flex items-center justify-center h-full">
      <Card>
        {error !== null && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Please fill the form to change you password
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid grid-cols-2 gap-4 w-full"
            onSubmit={handleFormSubmit}
          >
            <div className="grid w-full items-center gap-1.5 col-span-2 ">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                placeholder="Enter old password"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, oldPassword: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                type="password"
                id="new-password"
                placeholder="Enter new password"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, newPassword: e.target.value })
                }
                required
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                type="text"
                id="confirm-new-Password"
                placeholder="Enter new password again"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    confirmNewPassword: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="grid w-full items-center gap-1.5 col-span-2">
              <Button>
                {!isLoading && (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Submit</span>
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
      </Card>
    </div>
  );
}

export default Register;
