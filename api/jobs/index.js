import connectDB from "../../lib/db.js";
import Job from "../../models/job.js";

await connectDB();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ msg: "Method not allowed" });

  try {
    const newJob = new Job({
      ...req.body,           // eventId, sentTo
      // createdOn automatically set
    });

    const savedJob = await newJob.save();
    return res.status(201).json(savedJob);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Error creating job" });
  }
}
