import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get("/", async (_, res) => {
  const [rows] = await db.query("SELECT * FROM orders ORDER BY id DESC");
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { customer_name, product_name, status } = req.body;

  await db.query(
    "INSERT INTO orders (customer_name, product_name, status) VALUES (?, ?, ?)",
    [customer_name, product_name, status]
  );

  res.json({ message: "Order created" });
});

router.put("/:id", async (req, res) => {
  const { status } = req.body;

  await db.query(
    "UPDATE orders SET status=? WHERE id=?",
    [status, req.params.id]
  );

  res.json({ message: "Order updated" });
});

router.delete("/:id", async (req, res) => {
  await db.query("DELETE FROM orders WHERE id=?", [req.params.id]);

  res.json({ message: "Order deleted" });
});

export default router;
