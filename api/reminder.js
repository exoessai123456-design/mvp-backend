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

// Strip milliseconds for exact minute comparisons
function stripMilliseconds(date) {
  const d = new Date(date);
  d.setMilliseconds(0);
  return d;
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

  // 5 minutes before event
  const reminderOffset = 5 * 60 * 1000;

  // Calculate dynamic reminder window
  let windowStart = roundToMinute(new Date(now.getTime() + reminderOffset - 5000)); // 5s tolerance
  let windowEnd   = roundToMinute(new Date(now.getTime() + reminderOffset + 5000)); // 5s tolerance

  console.log("Reminder window (UTC):", windowStart.toISOString(), "→", windowEnd.toISOString());

  // Query events in this window
  const events = await Event.find({
    status: "CONFIRMED",
    reminderSent: { $ne: true },
    date: { $gte: windowStart, $lt: windowEnd },
  });

  console.log(`Found ${events.length} events to remind`);

  let processed = 0;

  for (const event of events) {
    try {
      console.log(`Sending reminder for event: ${event.title} (${event._id}) at ${event.date.toISOString()}`);

      await sendEmail(event.createdBy, event.title, event.date);

      // Mark as reminded
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
