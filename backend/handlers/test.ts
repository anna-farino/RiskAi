import { Request, Response } from 'express';

export async function handleTest(req: Request, res: Response) {
  console.log("🧪 [TEST] Received test request", {
    method: req.method,
    path: req.path,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });

  try {
    const response = { message: 'Hello, world!' };
    console.log("✅ [TEST] Sending response:", response);
    res.json(response);
  } catch (error) {
    console.error("❌ [TEST] Error:", error);
    res.status(500).json({ error: 'Test endpoint error' });
  }
}