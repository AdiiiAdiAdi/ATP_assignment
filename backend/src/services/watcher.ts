import { db } from "../db";
import { io } from "../server";

let lastSeenId = 0;

export const startWatcher = () => {
  setInterval(async () => {
    const [rows]: any = await db.query(
      "SELECT * FROM change_log WHERE id > ? ORDER BY id ASC",
      [lastSeenId]
    );

    for (const change of rows) {
      lastSeenId = change.id;

      let orderData = null;

      if (change.operation_type !== "DELETE") {
        const [orderRows]: any = await db.query(
          "SELECT * FROM orders WHERE id = ?",
          [change.order_id]
        );

        orderData = orderRows[0];
      }

      io.emit("order_change", {
        event: change.operation_type,
        orderId: change.order_id,
        customerName: orderData?.customer_name || "—",
        productName: orderData?.product_name || "—",
        data: orderData,
        timestamp: change.created_at
      });

      console.log("Emitted:", change.operation_type, change.order_id);
    }
  }, 1000);
};

