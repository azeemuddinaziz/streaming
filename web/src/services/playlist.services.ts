import axios from "axios";

const createPlaylist = async (name: string, description: string) => {
  try {
    const { data } = await axios.post(
      `/playlist/create`,
      {
        name,
        description,
      },
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

const getUserPlaylist = async (userId: string) => {
  try {
    const { data } = await axios.get(`/playlist/getUsersPlaylists/${userId}`);
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const getPlaylistById = async (playlistId: string) => {
  try {
    const { data } = await axios.get(`/playlist/getPlaylistById/${playlistId}`);
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const updatePlaylistDetails = async (
  name: string,
  description: string,
  playlistId: string
) => {
  try {
    const { data } = await axios.patch(
      `/playlist/updatePlaylist/${playlistId}`,
      {
        name,
        description,
      },
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

const removeVideoFromPlaylist = async (playlistId: string, videoId: string) => {
  try {
    const { data } = await axios.patch(
      `/playlist/removeVideo/${playlistId}/${videoId}`,
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

const addVideoToPlaylist = async (playlistId: string, videoId: string) => {
  try {
    const { data } = await axios.patch(
      `/playlist/addVideo/${playlistId}/${videoId}`,
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

const deletePlaylist = async (playlistId: string) => {
  try {
    const { data } = await axios.delete(
      `/playlist/deletePlaylist/${playlistId}`,
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
  createPlaylist,
  getUserPlaylist,
  getPlaylistById,
  updatePlaylistDetails,
  removeVideoFromPlaylist,
  addVideoToPlaylist,
  deletePlaylist,
};
