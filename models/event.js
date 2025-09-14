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

    // ✅ new field: track if reminder was already sent
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

delete mongoose.models.Event;
const Event =
  mongoose.models.Event || mongoose.model("Event", eventSchema);

export default Event;
