import axios from "axios";

const getTweetsByUserId = async (userId: string) => {
  try {
    const { data } = await axios.get(`/tweet/getUserTweets/${userId}`, {
      withCredentials: true,
    });

    return data.data;
  } catch (error) {
    //@ts-ignore
    return error;
  }
};

const createTweet = async (content: string) => {
  try {
    const { data } = await axios.post(
      `/tweet/create`,
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
    return error;
  }
};

const deleteTweet = async (tweetId: string) => {
  try {
    const { data } = await axios.delete(`/tweet/delete/${tweetId}`, {
      withCredentials: true,
    });

    return data.data;
  } catch (error) {
    //@ts-ignore
    return error;
  }
};

const updateTweet = async (content: string, tweetId: string) => {
  try {
    const { data } = await axios.patch(
      `/tweet/update/${tweetId}`,
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
    return error;
  }
};

export { getTweetsByUserId, createTweet, deleteTweet, updateTweet };
