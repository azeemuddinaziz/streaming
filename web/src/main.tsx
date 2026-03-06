import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@/index.css";
import { ThemeProvider } from "@/components/ThemeProvider.tsx";
import Error from "@/pages/Error.tsx";
import Home from "@/pages/Home.tsx";
import MainLayout from "./layouts/MainLayout.tsx";
import { ProtectedRoute } from "@/layouts/ProtectedRoute.tsx";
import Login from "@/pages/Login.tsx";
import Register from "@/pages/Register.tsx";
import PlayVideo from "@/pages/PlayVideo.tsx";
import SimpleLayout from "@/layouts/SimpleLayout.tsx";
import { AuthProvider } from "@/context/AuthContext.tsx";
import Profile from "./pages/Profile.tsx";
import Logout from "./pages/Logout.tsx";
import Subscriptions from "./pages/Subscriptions.tsx";
import SearchResults from "./pages/SearchResults.tsx";
import Upload from "./pages/UploadVideo.tsx";
import RefreshToken from "./pages/RefreshToken.tsx";
import ChangePassword from "./pages/ChangePassword.tsx";
import PlaylistView from "./pages/PlaylistView.tsx";
import { Toaster } from "sonner";
import axios from "axios";

axios.defaults.baseURL = "https://streaming-backend-y4ex.onrender.com/api/v1";
axios.defaults.withCredentials = true;

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <Error />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/results",
        element: <SearchResults />,
      },
      {
        path: "/playlist/:username/:playlistId",
        element: <PlaylistView />,
      },
    ],
  },
  {
    element: <SimpleLayout />,
    errorElement: <Error />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/register",
        element: <Register />,
      },
      {
        path: "/refresh",
        element: <RefreshToken />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <Error />,
    children: [
      {
        path: "/profile/:username",
        element: <Profile />,
      },
      {
        path: "/subscriptions",
        element: <Subscriptions />,
      },
      {
        path: "/history",
        element: <div>History</div>,
      },
      {
        path: "/search/:videoId",
        element: <PlayVideo />,
      },
      {
        path: "/logout",
        element: <Logout />,
      },
    ],
  },
  {
    element: <ProtectedRoute isSimple />,
    errorElement: <Error />,
    children: [
      {
        path: "/upload",
        element: <Upload />,
      },
      {
        path: "/change-password",
        element: <ChangePassword />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
