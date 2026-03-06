import axios from "axios";

const toggleSubscription = async (channelId: string) => {
  try {
    const { data } = await axios.post(
      `/subscription/subscribe/${channelId}`,
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

const getSubscriptionList = async (userId: string) => {
  try {
    const { data } = await axios.get(`/subscription/channelList/${userId}`);
    return data.data;
  } catch (error) {
    //@ts-ignore
    return error.status;
  }
};

export { toggleSubscription, getSubscriptionList };
