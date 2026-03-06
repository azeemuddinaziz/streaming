import axios from "axios";

const toggleLikeVideo = async (videoId: string) => {
  try {
    const { data } = await axios.post(
      `/like/toggleLikeVideo/${videoId}`,
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

const getLikedVideos = async () => {
  try {
    const { data } = await axios.get(`/like/getLikedVideos/`, {
      withCredentials: true,
    });
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

export { toggleLikeVideo, getLikedVideos };
