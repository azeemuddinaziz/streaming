import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = Schema(
  {
    videoFile: {
      type: String, //cloudinary URL
      required: true,
    },

    thumbnail: {
      type: String, //cloudinary URL
      required: true,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
    },

    views: {
      type: Number,
      default: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timespams: true }
);

mongoose.plugin(aggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
