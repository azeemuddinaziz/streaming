import { Tweet } from "../models/tweet.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

const createTweet = asyncHandler(async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) throw new ApiError(400, "The fields are required.");

    const tweet = await Tweet.create({
      owner: req.user?._id,
      content,
    });

    if (!tweet) throw new ApiError(501, "Failed to create tweet.");

    return res
      .status(200)
      .json(new ApiResponse(200, tweet, "Tweet created successfully."));
  } catch (error) {
    throw new ApiError(500, error || "Something went wrong.");
  }
});

const getUserTweets = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) throw new ApiError(400, "UserId is required.");

    const tweets = await Tweet.find({ owner: userId });

    if (!tweets) throw new ApiError(404, "No tweets found.");

    return res
      .status(200)
      .json(new ApiResponse(200, tweets, "Tweets fetched successfully."));
  } catch (error) {
    throw new ApiError(
      500,
      error || "Failed to fetch tweets, somehing went wrong."
    );
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  try {
    const { content } = req.body;
    const { tweetId } = req.params;

    if (!tweetId) throw new ApiError(200, "Tweet id is required.");

    const tweet = await Tweet.findByIdAndUpdate(
      tweetId,
      { content },
      { new: true }
    );

    if (!tweet) throw new ApiError(400, "Tweet not found.");

    return res
      .status(200)
      .json(new ApiResponse(200, tweet, "Tweet updated successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error || "Something went wrong while updating tweet."
    );
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  try {
    const { tweetId } = req.params;

    if (!tweetId) throw new ApiError(400, "tweetId is required.");

    await Tweet.deleteOne({ _id: tweetId });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet deleted successfully."));
  } catch (error) {
    throw new ApiError(500, error || "Failed to delete tweet");
  }
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
