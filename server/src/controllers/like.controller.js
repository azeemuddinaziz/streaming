import { asyncHandler } from "../utils/asyncHandler.js";
import { Like } from "../models/like.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) throw new ApiError(400, "videoId is required.");

    let like = await Like.find({ video: videoId });

    if (like == "") {
      like = await Like.create({
        video: videoId,
        likedBy: req.user?._id,
      });
      if (!like) throw new ApiError(500, "Error while adding like to video.");

      return res
        .status(200)
        .json(new ApiResponse(200, like, "Like added successfully."));
    } else {
      await Like.deleteOne({ video: videoId });

      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Like removed successfully."));
    }
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while like toggle."
    );
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!commentId) throw new ApiError(400, "commentId is required.");

    let like = await Like.find({ comment: commentId });

    if (like == "") {
      like = await Like.create({
        comment: commentId,
        likeddBy: req.user?._id,
      });
      if (!like) throw new ApiError(500, "Error while adding like to comment.");

      return res
        .status(200)
        .json(new ApiResponse(200, like, "Like added successfully."));
    } else {
      await Like.deleteOne({ comment: commentId });

      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Like removed successfully."));
    }
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while like toggle."
    );
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  try {
    const { tweetId } = req.params;
    if (!tweetId) throw new ApiError(400, "tweetId is required.");

    let like = await Like.find({ tweet: tweetId });

    if (like == "") {
      like = await Like.create({
        tweet: tweetId,
        likeddBy: req.user?._id,
      });
      if (!like) throw new ApiError(500, "Error while adding like to tweet.");

      return res
        .status(200)
        .json(new ApiResponse(200, like, "Like added successfully."));
    } else {
      await Like.deleteOne({ tweet: tweetId });

      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Like removed successfully."));
    }
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while like toggle."
    );
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  try {
    const likedVideos = await Like.find({ likedBy: req.user?._id });
    if (!likedVideos) throw new ApiError(404, "Liked videos not found.");

    return res
      .status(200)
      .json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully.")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        error ||
        "Something went wrong while fetching liked videos."
    );
  }
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
