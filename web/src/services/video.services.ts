import axios from "axios";

const getAllVideos = async (query: String = "") => {
  try {
    const { data } = await axios.get(`/video/results?query=${query}`);

    return data.data.docs;
  } catch (error) {
    return error;
  }
};

const getVideoById = async (videoId: String) => {
  try {
    const { data } = await axios.get(`/video/search/${videoId}`, {
      withCredentials: true,
    });
    return data.data.video;
  } catch (error) {
    return error;
  }
};

const uploadVideo = async (
  title: string,
  description: string,
  video: string,
  thumbnail: string
) => {
  try {
    const { data } = await axios.post(
      "/video/publishVideo",
      {
        title,
        description,
        video,
        thumbnail,
      },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      }
    );

    return data.statusCode.data;
  } catch (error) {
    return error;
  }
};

export { getAllVideos, getVideoById, uploadVideo };
