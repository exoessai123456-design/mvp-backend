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

// Send email function (always UTC)
async function sendEmail(to, title, date) {
  const utcDate = new Date(date).toISOString(); // keep UTC

  return transporter.sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject: `Reminder: "${title}" event in 5 minutes`,
    text: `Hello,\n\nThis is a reminder for your event: "${title}" scheduled at ${utcDate} (UTC).\n\n- Event Dashboard`,
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
  const oneMinuteTolerance = 60000; // 1 minute tolerance

  // Target reminder time = 5 minutes before the event
  const windowStart = new Date(now.getTime() + 5 * 60000 - oneMinuteTolerance);
  const windowEnd = new Date(now.getTime() + 5 * 60000 + oneMinuteTolerance);

  console.log("Now (UTC):", now.toISOString());
  console.log("Reminder window (UTC):", windowStart.toISOString(), "→", windowEnd.toISOString());

  const events = await Event.find({
    status: "CONFIRMED",
    reminderSent: { $ne: true },
    date: { $gte: windowStart, $lt: windowEnd },
  });

  console.log(`Found ${events.length} events to remind`);

  let processed = 0;

  for (const event of events) {
    try {
      console.log(`Sending reminder for event: ${event.title} | Date (UTC): ${event.date.toISOString()}`);

      // Send email
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
