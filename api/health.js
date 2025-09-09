import { withCors } from "../../lib/middleware.js";

function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("ok");
  }

  return res.status(405).json({ message: "Method not allowed" });
}

export default withCors(handler);