import jwt from "jsonwebtoken";

// Public routes
export function withCors(handler) {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.FRONTEND_URL
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") return res.status(200).end();

    return handler(req, res);
  };
}

// Private routes
export function withAuth(handler) {
  return withCors(async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "No token, auth denied" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = decoded.admin; // attach admin info
      return handler(req, res);
    } catch {
      return res.status(401).json({ msg: "Token is not valid" });
    }
  });
}
