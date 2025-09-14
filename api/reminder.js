import connectDB from "../lib/db.js";
import Job from "../models/job.js";
import nodemailer from "nodemailer";
import { MongoClient, ObjectId } from "mongodb";

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

  const { secret } = req.query;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ msg: "Forbidden" });
  }

  await connectDB();

  const now = new Date();
  const windowStart = roundToMinute(now);
  const windowEnd = new Date(windowStart.getTime() + 60 * 1000);

  console.log("Reminder window (UTC):", windowStart.toISOString(), "→", windowEnd.toISOString());

  const reminderOffset = 5 * 60 * 1000; // 5 minutes

  // Use Mongoose to fetch events
  const eventsAll = await connectDB.Event.find({
    status: { $in: ["CONFIRMED", "CANCELLED"] },
    reminderSent: { $ne: true },
  });

  const events = eventsAll.filter(event => {
    const eventDate = new Date(event.date);
    const reminderTime = eventDate.getTime() - reminderOffset;
    return reminderTime >= windowStart.getTime() && reminderTime < windowEnd.getTime();
  });

  console.log(`Found ${events.length} events to process`);

  // Connect raw MongoDB driver directly to the DB in the URI
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db(); // ✅ uses DB from URI
  const eventsCollection = db.collection("events");

  let processed = 0;

  for (const event of events) {
    try {
      if (event.status === "CANCELLED") {
        console.log(`Skipping email for cancelled event: ${event.title} (${event._id})`);

        await Job.create({
          eventId: event._id,
          createdOn: new Date().toISOString(),
          sentTo: event.createdBy,
          status: "FAILED",
          motifFailure: `Event status changed to ${event.status}`,
        });

        // serverless-safe reminderSent update
        await eventsCollection.updateOne(
          { _id: new ObjectId(event._id) },
          { $set: { reminderSent: true } }
        );

        continue;
      }

      console.log(`Sending reminder for event: ${event.title} (${event._id}) at ${event.date}`);
      await sendEmail(event.createdBy, event.title, event.date);

      // serverless-safe reminderSent update
      await eventsCollection.updateOne(
        { _id: new ObjectId(event._id) },
        { $set: { reminderSent: true } }
      );

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

  await client.close();

  const response = { processed, checked: events.length };
  console.log("API response:", response);

  return res.json(response);
}
