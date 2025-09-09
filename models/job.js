import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: null },
  sentTo: { type: String, required: true },
  status: {
    type: String,
    enum: ["PREPARED", "SENT", "FAILED"],
    default: "PREPARED",
  },
  motifFailure: { type: String, default: null },
});

// Reuse existing model if it exists
const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);

export default Job;
