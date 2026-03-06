import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const getVideoComments = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const options = { page: parseInt(page), limit: parseInt(limit) };

    const comments = await Comment.aggregatePaginate(
      Comment.aggregate({ $match: { video: videoId } }),
      options
    );

    await User.populate(comments.docs, {
      path: "owner",
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          comments,
          "Comments on video fetched successfully."
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        error ||
        "Something went wrong while fetching comments on video."
    );
  }
});

const addComment = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content } = req.body;
    if (!videoId || !content) {
      throw new ApiError(400, "videoId and content is required.");
    }

    const comment = await Comment.create({
      content,
      video: videoId,
      owner: req.user?._id,
    });
    if (!comment) {
      throw new ApiError(500, "Error while adding comment to video.");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          comment,
          "Comment was added to the video successfully."
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while adding comment."
    );
  }
});

const updateComment = asyncHandler(async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!commentId || !content) {
      throw new ApiError(400, "commentId and content is required.");
    }

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { content },
      { new: true }
    );
    if (!comment) {
      throw new ApiError(500, "Error while updating comment.");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, comment, "Comment was updated successfully."));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while updating comment."
    );
  }
});

const deleteComment = asyncHandler(async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!commentId) throw new ApiError(400, "commendId is required.");

    await Comment.deleteOne({ _id: commentId });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Comment deleted successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while deleting comment."
    );
  }
});

export { getVideoComments, addComment, updateComment, deleteComment };
