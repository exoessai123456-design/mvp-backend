import connectDB from "../../lib/db.js";
import Job from "../../models/job.js";

await connectDB();

export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ msg: "Method not allowed" });

  try {
    const updatedJob = await Job.findOneAndUpdate(
      { eventId: req.query.eventId },
      { ...req.body, updatedOn: new Date() },
      { new: true }
    );

    if (!updatedJob) return res.status(404).json({ msg: "Job not found" });
    return res.json(updatedJob);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error updating job" });
  }
}
