import { Router, json, urlencoded } from "express";

export function createWebhookRouter(
  onWebhook: (payload: unknown) => void
) {
  const router = Router();

  // Parse both JSON (Bland webhooks) and form-encoded (Twilio SMS webhooks)
  router.use(json());
  router.use(urlencoded({ extended: true }));

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.post("/webhook", (req, res) => {
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      console.error("[webhook] Received malformed payload");
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    console.log("[webhook] Received payload:", JSON.stringify(payload).slice(0, 200));
    onWebhook(payload);
    res.status(200).json({ received: true });
  });

  return router;
}
