import mongoose from "mongoose";

// Connect to MongoDB
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // already connected

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw new Error("MongoDB connection failed");
  }
};

export default connectDB;

// Optional: export models
const eventSchema = new mongoose.Schema({
  title: String,
  date: String,
  name: String,
  phone: String,
  type: String,
  status: { type: String, enum: ["CONFIRMED","COMPLETED","CANCELLED","DELETED"], default: "CONFIRMED" },
  createdBy: String,
});
export const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);

const jobSchema = new mongoose.Schema({
  eventId: String,
  createdOn: String,
  updatedOn: { type: String, default: null },
  sentTo: String,
  status: { type: String, enum: ["PREPARED","SENT","FAILED"], default: "PREPARED" },
  motifFailure: { type: String, default: null },
});
export const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
