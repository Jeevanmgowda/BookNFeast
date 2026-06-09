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
