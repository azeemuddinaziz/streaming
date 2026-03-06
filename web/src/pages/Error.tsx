import { Button } from "@/components/ui/button";
import { useRouteError } from "react-router-dom";

type ErrorType = {
  statusText?: string;
  message?: string;
};

export default function Error() {
  const error = useRouteError() as ErrorType;

  return (
    <div className="flex flex-col gap-6 items-center justify-center h-screen">
      <h1 className="text-4xl font-bold">Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p className="font-thin">
        <i>{error.statusText || error.message}</i>
      </p>

      <Button>
        <a href="/">Go back to StreamSouk</a>{" "}
      </Button>
    </div>
  );
}
