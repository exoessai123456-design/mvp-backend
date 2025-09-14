import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  createdOn: { type: Date, default: Date.now },
  sentTo: { type: String, required: true },
  status: {
    type: String,
    enum: ["SENT", "FAILED"]
  },
  motifFailure: { type: String, default: null },
});


// Reuse existing model if it exists
delete mongoose.models.Job;
const Job = mongoose.model("Job", jobSchema);

export default Job;
