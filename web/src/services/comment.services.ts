import axios from "axios";

const addCommentToVideo = async (videoId: string, content: string) => {
  try {
    const { data } = await axios.post(
      `/comment/add/${videoId}`,
      {
        content,
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

const getVideoComments = async (videoId: string) => {
  try {
    const { data } = await axios.get(`/comment/getVideoComments/${videoId}`, {
      withCredentials: true,
    });
    return data.data.docs;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

const updateComment = async (commentId: string, content: string) => {
  try {
    const { data } = await axios.patch(
      `/comment/update/${commentId}`,
      {
        content,
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

const deleteComment = async (commentId: string) => {
  try {
    const { data } = await axios.delete(`/comment/delete/${commentId}`, {
      withCredentials: true,
    });
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

export { addCommentToVideo, getVideoComments, updateComment, deleteComment };
