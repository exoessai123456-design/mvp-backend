import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ["CONFIRMED", "COMPLETED", "CANCELLED", "DELETED"],
      default: "CONFIRMED",
    },
    createdBy: { type: String, required: true },

    // ✅ new field
    reminderSent: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

delete mongoose.models.Event;
const Event = mongoose.model("Event", eventSchema);

export default Event;
