import connectDB, { Event } from "../lib/db.js";
import Job from "../models/job.js";
import nodemailer from "nodemailer";
import { withAuth } from "../lib/middleware.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.ADMIN_EMAIL, pass: process.env.ADMIN_PASS },
});

async function sendEmail(to, title, date) {
  return transporter.sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject: `Reminder: "${title}" event in 5 minutes`,
    text: `Hello,\n\nThis is a reminder for your event: "${title}" scheduled at ${new Date(
      date
    ).toLocaleString()}.\n\n- Event Dashboard`,
  });
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ msg: "Method not allowed" });
  }

  await connectDB();

  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);

  // Convert to UTC for MongoDB query
  const nowUTC = new Date(now.toISOString());
  const fiveMinutesLaterUTC = new Date(fiveMinutesLater.toISOString());

  const events = await Event.find({
    date: { $gte: nowUTC, $lte: fiveMinutesLaterUTC },
  });

  let processed = 0;

  for (const event of events) {
    try {
      if (event.status === "CONFIRMED") {
        await sendEmail(event.createdBy, event.title, event.date);
        await Job.create({
          eventId: event._id,
          createdOn: new Date().toISOString(),
          sentTo: event.createdBy,
          status: "SENT",
        });
      } else if (event.status === "DELETED" || event.status === "CANCELLED") {
        await Job.create({
          eventId: event._id,
          createdOn: new Date().toISOString(),
          sentTo: event.createdBy,
          status: "FAILED",
          motifFailure: event.status,
        });
      }
      processed++;
    } catch (err) {
      console.error(`Failed event ${event._id}:`, err);
      await Job.create({
        eventId: event._id,
        createdOn: new Date().toISOString(),
        sentTo: event.createdBy,
        status: "FAILED",
        motifFailure: err.message,
      });
    }
  }

  return res.json({ processed });
}

// ✅ Wrap withAuth so CORS + JWT are applied
export default withAuth(handler);
