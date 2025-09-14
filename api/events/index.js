import connectDB from "../../lib/db.js";
import Event from "../../models/event.js";
import { withAuth } from "../../lib/middleware.js";

async function handler(req, res) {
  await connectDB();

  const { method } = req;

  if (method === "GET") {
    try {
      const events = await Event.find({
        createdBy: req.admin.email, // ✅ req.admin comes from withAuth
        status: { $ne: "DELETED" },
      });
      return res.status(200).json(events);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching events" });
    }
  }

  if (method === "POST") {
    try {
      const newEvent = new Event({
        ...req.body,
        createdBy: req.admin.email
      });
      const savedEvent = await newEvent.save();
      return res.status(201).json(savedEvent);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error creating event" });
    }
  }

  return res.status(405).json({ message: `Method ${method} not allowed` });
}

export default withAuth(handler);
