import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlist.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const createPlaylist = asyncHandler(async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) throw new ApiError(400, "Name field is required.");

    const playlist = await Playlist.create({
      name,
      description,
      owner: req?.user?._id,
    });
    if (!playlist) throw new ApiError(500, "Failed to create playlist.");

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist created successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while creating playlist."
    );
  }
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) throw new ApiError(400, "userId is required.");

    const playlists = await Playlist.find({ owner: userId });
    if (!playlists) throw new ApiError(400, "Error while finding playlists.");

    return res
      .status(200)
      .json(new ApiResponse(200, playlists, "Playlists fetched successfully/"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while fetching playlsits."
    );
  }
});

const getPlaylistById = asyncHandler(async (req, res) => {
  try {
    const { playlistId } = req.params;
    if (!playlistId) throw new ApiError(400, "playlistId is required.");

    const playlist = await Playlist.findById({ _id: playlistId }).populate({
      path: "videos",
      populate: {
        path: "owner",
        model: "User",
      },
    });
    if (!playlist) throw new ApiError(400, "Error while finding playlists.");

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist fetched successfully/"));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while fetching playlsits."
    );
  }
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;

    if (!playlistId || !videoId) {
      throw new ApiError(400, "PlaylistId and VideoId are required.");
    }

    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      { $addToSet: { videos: videoId } },
      { new: true }
    );
    if (!playlist) {
      throw new ApiError(400, "Error finding or adding videos to playlist.");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, playlist, "Video added to playlist successfully.")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        error ||
        "Something went wrong while adding video to playlist"
    );
  }
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;
    if (!playlistId || !videoId) {
      throw new ApiError(400, "PlaylistId and VideoId are required.");
    }

    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      { $pull: { videos: videoId } },
      { new: true }
    );
    if (!playlist) {
      throw new ApiError(400, "Error finding or adding videos to playlist.");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          playlist,
          "Video removed from playlist successfully."
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        error ||
        "Something went wrong while removing video from playlist"
    );
  }
});

const deletePlaylist = asyncHandler(async (req, res) => {
  try {
    const { playlistId } = req.params;

    if (!playlistId) throw new ApiError(400, "playlistId is required.");

    await Playlist.deleteOne({ _id: playlistId });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Playlist deleted successfully."));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while deleting playlist."
    );
  }
});

const updatePlaylist = asyncHandler(async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!playlistId) {
      throw new ApiError(400, "playlistId is required.");
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, "No fields provided to update.");
    }

    const playlist = await Playlist.findByIdAndUpdate(playlistId, updateData, {
      new: true,
    });

    if (!playlist) {
      throw new ApiError(400, "Error either finding or updating playlist.");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Successfully updated playlist."));
  } catch (error) {
    throw new ApiError(
      500,
      error.message || error || "Something went wrong while updating playlist."
    );
  }
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
