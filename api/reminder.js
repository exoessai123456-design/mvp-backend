import connectDB, { Event } from "../lib/db.js";
import Job from "../models/job.js";
import nodemailer from "nodemailer";

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_PASS,
  },
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ msg: "Method not allowed" });
  }

  // 🔒 Secure with CRON_SECRET
  const { secret } = req.query;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ msg: "Forbidden" });
  }

  await connectDB();

  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);

  // Query events happening within the next 5 minutes
  const events = await Event.find({
    date: { $gte: now, $lte: fiveMinutesLater },
    reminderSent: { $ne: true }, // only events not yet reminded
  });

  let processed = 0;

  for (const event of events) {
    try {
      if (event.status === "CONFIRMED" && !event.reminderSent) {
        // Send email
        await sendEmail(event.createdBy, event.title, event.date);

        // Mark event as reminded
        event.reminderSent = true;
        await event.save();

        // Log success
        await Job.create({
          eventId: event._id,
          createdOn: new Date().toISOString(),
          sentTo: event.createdBy,
          status: "SENT",
        });
      } else if (event.status === "DELETED" || event.status === "CANCELLED") {
        // Log cancellation
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
      console.error(`Failed event ${event._id}:`, err.message);
      await Job.create({
        eventId: event._id,
        createdOn: new Date().toISOString(),
        sentTo: event.createdBy,
        status: "FAILED",
        motifFailure: err.message,
      });
    }
  }

  return res.json({ processed, checked: events.length });
}
