import axios from "axios";

const registerUser = async (
  fullname: String,
  username: String,
  email: String,
  password: String,
  avatar: File,
  coverImage: File
) => {
  try {
    const { data } = await axios.post(
      "/users/register",
      {
        fullname,
        username,
        email,
        password,
        avatar,
        coverImage,
      },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return data.statusCode.data;
  } catch (error) {
    return error;
  }
};

const loginUser = async (username: String, password: String) => {
  try {
    const { data } = await axios.post(
      "/users/login",
      {
        username,
        password,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        withCredentials: true,
      }
    );

    return data.data.user;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const getCurrentUser = async () => {
  try {
    const { data } = await axios.get("/users/currentUser", {
      withCredentials: true,
    });
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const getUserByUsername = async (username: string) => {
  try {
    const { data } = await axios.get(`/users/channel/${username}`);
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const getChannelByChannelName = async (channelname: string) => {
  try {
    const { data } = await axios.get(`/users/channel/${channelname}`, {
      withCredentials: true,
    });
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const refreshUserTokens = async () => {
  try {
    const { data } = await axios.post(
      `/users/refreshToken`,
      {},
      {
        withCredentials: true,
      }
    );
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const changeCoverImage = async (coverImage: File) => {
  try {
    const { data } = await axios.patch(
      `/users/updateCoverImage`,
      { coverImage },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      }
    );
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const changeAvatar = async (avatar: File) => {
  try {
    const { data } = await axios.patch(
      `/users/updateAvatar`,
      { avatar },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      }
    );
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const changePassword = async (oldPassword: string, newPassword: string) => {
  try {
    const { data } = await axios.post(
      `/users/changePassword`,
      {
        oldPassword,
        newPassword,
      },
      {
        withCredentials: true,
      }
    );

    return data.data;
  } catch (error) {
    //@ts-ignore
    return error;
  }
};

const logOutUser = async () => {
  try {
    const { data } = await axios.post(
      `/users/logout`,
      {},
      {
        withCredentials: true,
      }
    );
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

export {
  registerUser,
  loginUser,
  getCurrentUser,
  getUserByUsername,
  getChannelByChannelName,
  logOutUser,
  refreshUserTokens,
  changeAvatar,
  changeCoverImage,
  changePassword,
};
