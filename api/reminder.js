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

// Send email in UTC
async function sendEmail(to, title, date) {
  const utcDate = new Date(date).toISOString();
  return transporter.sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject: `Reminder: "${title}" event`,
    text: `Hello,\n\nThis is a reminder for your event: "${title}" scheduled at ${utcDate} (UTC).\n\n- Event Dashboard`,
  });
}

// Round down to exact minute
function roundToMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ msg: "Method not allowed" });
  }

  // Secure with CRON_SECRET
  const { secret } = req.query;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ msg: "Forbidden" });
  }

  await connectDB();

  const now = new Date(); // current UTC

  // Dynamic reminder window: 1 minute starting now
  const windowStart = roundToMinute(now);
  const windowEnd = new Date(windowStart.getTime() + 60 * 1000); // 1 minute window

  console.log("Reminder window (UTC):", windowStart.toISOString(), "→", windowEnd.toISOString());

  // Find events whose reminder time (event date - 5min) is inside the window
  const events = await Event.find({
    status: "CONFIRMED",
    reminderSent: { $ne: true },
    $expr: {
      $and: [
        { $gte: [{ $subtract: ["$date", 5 * 60 * 1000] }, windowStart] },
        { $lt:  [{ $subtract: ["$date", 5 * 60 * 1000] }, windowEnd] }
      ]
    }
  });

  console.log(`Found ${events.length} events to remind`);

  let processed = 0;

  for (const event of events) {
    try {
      console.log(`Sending reminder for event: ${event.title} (${event._id}) at ${event.date.toISOString()}`);

      await sendEmail(event.createdBy, event.title, event.date);

      // Mark event as reminded
      event.reminderSent = true;
      await event.save();

      // Log success in Job collection
      await Job.create({
        eventId: event._id,
        createdOn: new Date().toISOString(),
        sentTo: event.createdBy,
        status: "SENT",
      });

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

  const response = { processed, checked: events.length };
  console.log("API response:", response);

  return res.json(response);
}
