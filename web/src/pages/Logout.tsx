import { logOutUser } from "@/services/user.services";
import { useState } from "react";
import { Navigate } from "react-router-dom";

function Logout() {
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  (async () => {
    await logOutUser();
    window.location.href = "/";
    setIsLoggedOut(true);
  })();

  if (isLoggedOut) return <Navigate to={"/"} />;

  return <div>Logging you out...</div>;
}

export default Logout;
