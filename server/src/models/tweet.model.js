import mongoose, { Schema } from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

const tweetSchema = Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

mongoose.plugin(aggregatePaginate);

export const Tweet = mongoose.model("Tweet", tweetSchema);
