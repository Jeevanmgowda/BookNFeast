USE hotel;

ALTER TABLE rooms
ADD CONSTRAINT chk_rooms_floor
CHECK (floor >= 0);

ALTER TABLE rooms
ADD CONSTRAINT chk_rooms_capacity
CHECK (capacity > 0);

ALTER TABLE rooms
ADD CONSTRAINT chk_rooms_price_per_night
CHECK (price_per_night >= 0);

ALTER TABLE bookings
ADD CONSTRAINT chk_bookings_dates
CHECK (check_out > check_in);

ALTER TABLE bookings
ADD CONSTRAINT chk_bookings_nights
CHECK (nights > 0);

ALTER TABLE bookings
ADD CONSTRAINT chk_bookings_amount
CHECK (amount >= 0);

ALTER TABLE bookings
ADD CONSTRAINT chk_bookings_guests
CHECK (adults >= 1 AND children >= 0);

ALTER TABLE menu_items
ADD CONSTRAINT chk_menu_items_price
CHECK (price >= 0);

ALTER TABLE restaurant_tables
ADD CONSTRAINT chk_restaurant_tables_number
CHECK (table_number > 0);

ALTER TABLE restaurant_tables
ADD CONSTRAINT chk_restaurant_tables_capacity
CHECK (capacity > 0);

ALTER TABLE orders
ADD CONSTRAINT chk_orders_amounts
CHECK (subtotal >= 0 AND tax >= 0 AND total >= 0);

ALTER TABLE order_items
ADD CONSTRAINT chk_order_items_price
CHECK (price >= 0);

ALTER TABLE order_items
ADD CONSTRAINT chk_order_items_qty
CHECK (qty > 0);

ALTER TABLE staff
ADD CONSTRAINT chk_staff_salary
CHECK (salary >= 0);

DROP TRIGGER IF EXISTS trg_admin_users_before_update;
CREATE TRIGGER trg_admin_users_before_update
BEFORE UPDATE ON admin_users
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_rooms_before_update;
CREATE TRIGGER trg_rooms_before_update
BEFORE UPDATE ON rooms
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_guests_before_update;
CREATE TRIGGER trg_guests_before_update
BEFORE UPDATE ON guests
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_bookings_before_update;
CREATE TRIGGER trg_bookings_before_update
BEFORE UPDATE ON bookings
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_menu_items_before_update;
CREATE TRIGGER trg_menu_items_before_update
BEFORE UPDATE ON menu_items
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_restaurant_tables_before_update;
CREATE TRIGGER trg_restaurant_tables_before_update
BEFORE UPDATE ON restaurant_tables
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_orders_before_update;
CREATE TRIGGER trg_orders_before_update
BEFORE UPDATE ON orders
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_staff_before_update;
CREATE TRIGGER trg_staff_before_update
BEFORE UPDATE ON staff
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_activity_before_update;
CREATE TRIGGER trg_activity_before_update
BEFORE UPDATE ON activity
FOR EACH ROW
SET NEW.updated_at = CURRENT_TIMESTAMP;

DROP TRIGGER IF EXISTS trg_bookings_after_insert_activity;
CREATE TRIGGER trg_bookings_after_insert_activity
AFTER INSERT ON bookings
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
VALUES (REPLACE(UUID(), '-', ''), 'BK', CONCAT('New booking: ', NEW.guest_name, ' - Room ', NEW.room_number), 'green', CURRENT_TIMESTAMP);

DROP TRIGGER IF EXISTS trg_bookings_after_update_room_status;
CREATE TRIGGER trg_bookings_after_update_room_status
AFTER UPDATE ON bookings
FOR EACH ROW
UPDATE rooms
SET status = CASE
  WHEN NEW.status = 'checked-in' THEN 'occupied'
  WHEN NEW.status IN ('checked-out', 'cancelled') THEN 'available'
  ELSE status
END
WHERE id = NEW.room_id
  AND NEW.room_id IS NOT NULL
  AND NEW.status <> OLD.status
  AND NEW.status IN ('checked-in', 'checked-out', 'cancelled');

DROP TRIGGER IF EXISTS trg_bookings_after_update_activity;
CREATE TRIGGER trg_bookings_after_update_activity
AFTER UPDATE ON bookings
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
SELECT REPLACE(UUID(), '-', ''), 'BK', CONCAT('Booking ', NEW.status, ': ', NEW.guest_name, ' - Room ', NEW.room_number),
  CASE WHEN NEW.status = 'cancelled' THEN 'red' WHEN NEW.status = 'checked-out' THEN 'gold' ELSE 'blue' END,
  CURRENT_TIMESTAMP
WHERE NEW.status <> OLD.status;

DROP TRIGGER IF EXISTS trg_bookings_after_delete_room_status;
CREATE TRIGGER trg_bookings_after_delete_room_status
AFTER DELETE ON bookings
FOR EACH ROW
UPDATE rooms
SET status = 'available'
WHERE id = OLD.room_id
  AND OLD.room_id IS NOT NULL
  AND OLD.status IN ('confirmed', 'checked-in');

DROP TRIGGER IF EXISTS trg_bookings_after_delete_activity;
CREATE TRIGGER trg_bookings_after_delete_activity
AFTER DELETE ON bookings
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
VALUES (REPLACE(UUID(), '-', ''), 'BK', CONCAT('Booking deleted: ', OLD.guest_name, ' - Room ', OLD.room_number), 'red', CURRENT_TIMESTAMP);

DROP TRIGGER IF EXISTS trg_orders_after_insert_table_status;
CREATE TRIGGER trg_orders_after_insert_table_status
AFTER INSERT ON orders
FOR EACH ROW
UPDATE restaurant_tables
SET status = 'occupied'
WHERE id = NEW.table_id
  AND NEW.table_id IS NOT NULL
  AND NEW.status = 'active';

DROP TRIGGER IF EXISTS trg_orders_after_insert_activity;
CREATE TRIGGER trg_orders_after_insert_activity
AFTER INSERT ON orders
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
VALUES (REPLACE(UUID(), '-', ''), 'OD', CONCAT('Order placed for Table ', COALESCE(NEW.table_number, 'N/A')), 'gold', CURRENT_TIMESTAMP);

DROP TRIGGER IF EXISTS trg_orders_after_update_table_status;
CREATE TRIGGER trg_orders_after_update_table_status
AFTER UPDATE ON orders
FOR EACH ROW
UPDATE restaurant_tables
SET status = CASE
  WHEN NEW.status = 'active' THEN 'occupied'
  WHEN NEW.status IN ('completed', 'cancelled') THEN 'available'
  ELSE status
END
WHERE id = NEW.table_id
  AND NEW.table_id IS NOT NULL
  AND NEW.status <> OLD.status
  AND NEW.status IN ('active', 'completed', 'cancelled');

DROP TRIGGER IF EXISTS trg_orders_after_update_activity;
CREATE TRIGGER trg_orders_after_update_activity
AFTER UPDATE ON orders
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
SELECT REPLACE(UUID(), '-', ''), 'OD', CONCAT('Order ', NEW.status, ' for Table ', COALESCE(NEW.table_number, 'N/A')),
  CASE WHEN NEW.status = 'cancelled' THEN 'red' WHEN NEW.status = 'completed' THEN 'green' ELSE 'gold' END,
  CURRENT_TIMESTAMP
WHERE NEW.status <> OLD.status;

DROP TRIGGER IF EXISTS trg_orders_after_delete_table_status;
CREATE TRIGGER trg_orders_after_delete_table_status
AFTER DELETE ON orders
FOR EACH ROW
UPDATE restaurant_tables
SET status = 'available'
WHERE id = OLD.table_id
  AND OLD.table_id IS NOT NULL
  AND OLD.status = 'active';

DROP TRIGGER IF EXISTS trg_orders_after_delete_activity;
CREATE TRIGGER trg_orders_after_delete_activity
AFTER DELETE ON orders
FOR EACH ROW
INSERT INTO activity (id, icon, message, type, activity_time)
VALUES (REPLACE(UUID(), '-', ''), 'OD', CONCAT('Order deleted for Table ', COALESCE(OLD.table_number, 'N/A')), 'red', CURRENT_TIMESTAMP);
