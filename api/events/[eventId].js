import connectDB, { Event } from "../../lib/db.js";
import { withAuth } from "../../lib/middleware.js";

async function handler(req, res) {
  await connectDB();

  const { method, query, body } = req;
  const { eventId } = query;

  try {
    if (method === "GET") {
      const event = await Event.findOne({
        _id: eventId,
        createdBy: req.admin.email, // ✅ req.admin comes from withAuth
      });
      if (!event) return res.status(404).json({ msg: "Event not found" });
      return res.json(event);
    }

    if (method === "PUT") {
      const updated = await Event.findOneAndUpdate(
        { _id: eventId, createdBy: req.admin.email },
        body,
        { new: true }
      );
      if (!updated) return res.status(404).json({ msg: "Event not found" });
      return res.json(updated);
    }

    if (method === "DELETE") {
      const deleted = await Event.findOneAndUpdate(
        { _id: eventId, createdBy: req.admin.email },
        { status: "DELETED" },
        { new: true }
      );
      if (!deleted) return res.status(404).json({ msg: "Event not found" });
      return res.status(204).end();
    }

    return res.status(405).json({ msg: `Method ${method} not allowed` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
}

export default withAuth(handler);
