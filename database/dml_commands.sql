USE hotel;

-- JOIN DML commands
-- 1. Booking details with guest and room information.
SELECT
  b.id AS booking_id,
  g.name AS guest_name,
  g.phone AS guest_phone,
  r.room_number,
  r.room_type,
  b.check_in,
  b.check_out,
  b.nights,
  b.amount,
  b.status
FROM bookings b
LEFT JOIN guests g ON b.guest_id = g.id
LEFT JOIN rooms r ON b.room_id = r.id
ORDER BY b.check_in DESC;

-- 2. Active restaurant orders with table details.
SELECT
  o.id AS order_id,
  rt.table_number,
  rt.section,
  rt.capacity,
  o.guest_name,
  o.waiter,
  o.subtotal,
  o.tax,
  o.total,
  o.status,
  o.created_at
FROM orders o
LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
WHERE o.status = 'active'
ORDER BY o.created_at DESC;

-- 3. Order item details with menu category and line total.
SELECT
  o.id AS order_id,
  o.table_number,
  mi.name AS menu_item,
  mi.category,
  oi.qty,
  oi.price,
  (oi.qty * oi.price) AS line_total,
  o.status AS order_status
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.id
LEFT JOIN menu_items mi ON oi.menu_id = mi.id
ORDER BY o.created_at DESC, mi.category, mi.name;

-- 4. Guests and their booking history.
SELECT
  g.id AS guest_id,
  g.name,
  g.email,
  g.phone,
  b.id AS booking_id,
  b.room_number,
  b.check_in,
  b.check_out,
  b.status
FROM guests g
LEFT JOIN bookings b ON g.id = b.guest_id
ORDER BY g.name ASC, b.check_in DESC;

-- 5. Rooms with the current checked-in booking, if any.
SELECT
  r.room_number,
  r.room_type,
  r.floor,
  r.status AS room_status,
  b.guest_name,
  b.check_in,
  b.check_out,
  b.status AS booking_status
FROM rooms r
LEFT JOIN bookings b
  ON r.id = b.room_id
  AND b.status = 'checked-in'
ORDER BY r.room_number ASC;

-- Aggregate DML commands
-- 1. Room count and average rate by room type.
SELECT
  room_type,
  COUNT(*) AS total_rooms,
  SUM(status = 'available') AS available_rooms,
  SUM(status = 'occupied') AS occupied_rooms,
  ROUND(AVG(price_per_night), 2) AS average_price
FROM rooms
GROUP BY room_type
ORDER BY room_type ASC;

-- 2. Booking count and revenue by booking status.
SELECT
  status,
  COUNT(*) AS total_bookings,
  SUM(nights) AS total_nights,
  SUM(amount) AS total_amount,
  ROUND(AVG(amount), 2) AS average_booking_amount
FROM bookings
GROUP BY status
ORDER BY total_bookings DESC;

-- 3. Monthly hotel revenue from checked-out bookings.
SELECT
  DATE_FORMAT(check_out, '%Y-%m') AS revenue_month,
  COUNT(*) AS completed_bookings,
  SUM(amount) AS hotel_revenue
FROM bookings
WHERE status = 'checked-out'
GROUP BY DATE_FORMAT(check_out, '%Y-%m')
ORDER BY revenue_month DESC;

-- 4. Restaurant revenue and order totals by status.
SELECT
  status,
  COUNT(*) AS total_orders,
  SUM(subtotal) AS subtotal_amount,
  SUM(tax) AS tax_amount,
  SUM(total) AS total_amount,
  ROUND(AVG(total), 2) AS average_order_value
FROM orders
GROUP BY status
ORDER BY total_orders DESC;

-- 5. Top selling menu items by quantity and revenue.
SELECT
  COALESCE(mi.name, oi.name) AS item_name,
  COALESCE(mi.category, 'Uncategorized') AS category,
  SUM(oi.qty) AS quantity_sold,
  SUM(oi.qty * oi.price) AS item_revenue
FROM order_items oi
LEFT JOIN menu_items mi ON oi.menu_id = mi.id
INNER JOIN orders o ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY COALESCE(mi.name, oi.name), COALESCE(mi.category, 'Uncategorized')
ORDER BY quantity_sold DESC, item_revenue DESC;

-- 6. Staff payroll summary by department and shift.
SELECT
  department,
  shift,
  COUNT(*) AS staff_count,
  SUM(salary) AS total_salary,
  ROUND(AVG(salary), 2) AS average_salary
FROM staff
GROUP BY department, shift
ORDER BY department ASC, shift ASC;

-- 7. Daily business summary combining hotel and restaurant revenue.
SELECT
  summary_date,
  SUM(hotel_revenue) AS hotel_revenue,
  SUM(restaurant_revenue) AS restaurant_revenue,
  SUM(hotel_revenue + restaurant_revenue) AS total_revenue
FROM (
  SELECT
    check_out AS summary_date,
    SUM(amount) AS hotel_revenue,
    0 AS restaurant_revenue
  FROM bookings
  WHERE status = 'checked-out'
  GROUP BY check_out

  UNION ALL

  SELECT
    DATE(created_at) AS summary_date,
    0 AS hotel_revenue,
    SUM(total) AS restaurant_revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY DATE(created_at)
) daily_revenue
GROUP BY summary_date
ORDER BY summary_date DESC;
