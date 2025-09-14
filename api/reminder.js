import connectDB, { Event } from "../lib/db.js";
import Job from "../models/job.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_PASS,
  },
});

async function sendEmail(to, title, date) {
  const utcDate = new Date(date).toISOString();
  return transporter.sendMail({
    from: process.env.ADMIN_EMAIL,
    to,
    subject: `Reminder: "${title}" event`,
    text: `Hello,\n\nThis is a reminder for your event: "${title}" scheduled at ${utcDate} (UTC).\n\n- Event Dashboard`,
  });
}

function roundToMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ msg: "Method not allowed" });
  if (req.query.secret !== process.env.CRON_SECRET) return res.status(403).json({ msg: "Forbidden" });

  await connectDB();

  const now = new Date();
  const windowStart = roundToMinute(now);
  const windowEnd = new Date(windowStart.getTime() + 60 * 1000);
  const reminderOffset = 5 * 60 * 1000;

  const eventsAll = await Event.find({
    status: { $in: ["CONFIRMED", "CANCELLED"] },
    reminderSent: { $ne: true },
  });

  const events = eventsAll.filter(ev => {
    const reminderTime = new Date(ev.date).getTime() - reminderOffset;
    return reminderTime >= windowStart.getTime() && reminderTime < windowEnd.getTime();
  });

  let processed = 0;

  for (const ev of events) {
    try {
      if (ev.status === "CANCELLED") {
        await Job.create({
          eventId: ev._id,
          createdOn: new Date(),
          sentTo: ev.createdBy,
          status: "FAILED",
          motifFailure: `Event status changed to ${ev.status}`,
        });
      } else {
        await sendEmail(ev.createdBy, ev.title, ev.date);
        await Job.create({
          eventId: ev._id,
          createdOn: new Date(),
          sentTo: ev.createdBy,
          status: "SENT",
        });
        processed++;
      }

      // ✅ mark as reminded in a single, explicit update
      await Event.findByIdAndUpdate(ev._id.toString(), { $set: { reminderSent: true } });

    } catch (err) {
      await Job.create({
        eventId: ev._id,
        createdOn: new Date(),
        sentTo: ev.createdBy,
        status: "FAILED",
        motifFailure: err.message,
      });
    }
  }

  return res.json({ processed, checked: events.length });
}
