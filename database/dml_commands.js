// MongoDB Aggregation Pipeline equivalents of the original SQL DML commands.
// Run these in MongoDB Shell (mongosh) or Compass against the booknfeast database.

// ============================================================
// JOIN-equivalent Aggregation Pipelines
// ============================================================

// 1. Booking details with guest and room information.
// Original: SELECT ... FROM bookings b LEFT JOIN guests g LEFT JOIN rooms r
db.bookings.aggregate([
  {
    $lookup: {
      from: "guests",
      let: { gid: "$guestId" },
      pipeline: [{ $match: { $expr: { $eq: ["$id", "$$gid"] } } }],
      as: "guest"
    }
  },
  { $unwind: { path: "$guest", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "rooms",
      let: { rid: "$roomId" },
      pipeline: [{ $match: { $expr: { $eq: ["$id", "$$rid"] } } }],
      as: "room"
    }
  },
  { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      booking_id: "$id",
      guest_name: { $ifNull: ["$guest.name", "$guestName"] },
      guest_phone: "$guest.phone",
      room_number: { $ifNull: ["$room.number", "$roomNumber"] },
      room_type: "$room.type",
      check_in: "$checkIn",
      check_out: "$checkOut",
      nights: 1,
      amount: 1,
      status: 1
    }
  },
  { $sort: { check_in: -1 } }
]);


// 2. Active restaurant orders with table details.
// Original: SELECT ... FROM orders o LEFT JOIN restaurant_tables rt WHERE o.status = 'active'
db.orders.aggregate([
  { $match: { status: "active" } },
  {
    $lookup: {
      from: "tables",
      let: { tid: "$tableId" },
      pipeline: [{ $match: { $expr: { $eq: ["$id", "$$tid"] } } }],
      as: "table"
    }
  },
  { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      order_id: "$id",
      table_number: "$tableNumber",
      section: "$table.section",
      capacity: "$table.capacity",
      guest_name: "$guestName",
      waiter: 1,
      subtotal: 1,
      tax: 1,
      total: 1,
      status: 1,
      created_at: "$createdAt"
    }
  },
  { $sort: { created_at: -1 } }
]);


// 3. Order item details with menu category and line total.
// Original: SELECT ... FROM order_items oi INNER JOIN orders o LEFT JOIN menu_items mi
// Note: In MongoDB, items are embedded in the order document.
db.orders.aggregate([
  { $unwind: "$items" },
  {
    $lookup: {
      from: "menuItems",
      let: { mid: "$items.menuId" },
      pipeline: [{ $match: { $expr: { $eq: ["$id", "$$mid"] } } }],
      as: "menuItem"
    }
  },
  { $unwind: { path: "$menuItem", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      order_id: "$id",
      table_number: "$tableNumber",
      menu_item: { $ifNull: ["$menuItem.name", "$items.name"] },
      category: { $ifNull: ["$menuItem.category", "Uncategorized"] },
      qty: "$items.qty",
      price: "$items.price",
      line_total: { $multiply: ["$items.qty", "$items.price"] },
      order_status: "$status"
    }
  },
  { $sort: { created_at: -1, category: 1, menu_item: 1 } }
]);


// 4. Guests and their booking history.
// Original: SELECT ... FROM guests g LEFT JOIN bookings b
db.guests.aggregate([
  {
    $lookup: {
      from: "bookings",
      let: { gid: "$id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$guestId", "$$gid"] } } },
        { $sort: { checkIn: -1 } }
      ],
      as: "bookings"
    }
  },
  { $unwind: { path: "$bookings", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      guest_id: "$id",
      name: 1,
      email: 1,
      phone: 1,
      booking_id: "$bookings.id",
      room_number: "$bookings.roomNumber",
      check_in: "$bookings.checkIn",
      check_out: "$bookings.checkOut",
      booking_status: "$bookings.status"
    }
  },
  { $sort: { name: 1, check_in: -1 } }
]);


// 5. Rooms with the current checked-in booking, if any.
// Original: SELECT ... FROM rooms r LEFT JOIN bookings b ON ... AND b.status = 'checked-in'
db.rooms.aggregate([
  {
    $lookup: {
      from: "bookings",
      let: { rid: "$id" },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ["$roomId", "$$rid"] }, { $eq: ["$status", "checked-in"] }] } } },
        { $limit: 1 }
      ],
      as: "activeBooking"
    }
  },
  { $unwind: { path: "$activeBooking", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      room_number: "$number",
      room_type: "$type",
      floor: 1,
      room_status: "$status",
      guest_name: "$activeBooking.guestName",
      check_in: "$activeBooking.checkIn",
      check_out: "$activeBooking.checkOut",
      booking_status: "$activeBooking.status"
    }
  },
  { $sort: { room_number: 1 } }
]);


// ============================================================
// Aggregate Pipelines
// ============================================================

// 1. Room count and average rate by room type.
db.rooms.aggregate([
  {
    $group: {
      _id: "$type",
      total_rooms: { $sum: 1 },
      available_rooms: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
      occupied_rooms: { $sum: { $cond: [{ $eq: ["$status", "occupied"] }, 1, 0] } },
      average_price: { $avg: "$pricePerNight" }
    }
  },
  { $project: { _id: 0, room_type: "$_id", total_rooms: 1, available_rooms: 1, occupied_rooms: 1, average_price: { $round: ["$average_price", 2] } } },
  { $sort: { room_type: 1 } }
]);


// 2. Booking count and revenue by booking status.
db.bookings.aggregate([
  {
    $group: {
      _id: "$status",
      total_bookings: { $sum: 1 },
      total_nights: { $sum: "$nights" },
      total_amount: { $sum: "$amount" },
      average_booking_amount: { $avg: "$amount" }
    }
  },
  { $project: { _id: 0, status: "$_id", total_bookings: 1, total_nights: 1, total_amount: 1, average_booking_amount: { $round: ["$average_booking_amount", 2] } } },
  { $sort: { total_bookings: -1 } }
]);


// 3. Monthly hotel revenue from checked-out bookings.
db.bookings.aggregate([
  { $match: { status: "checked-out" } },
  {
    $group: {
      _id: { $substr: ["$checkOut", 0, 7] },
      completed_bookings: { $sum: 1 },
      hotel_revenue: { $sum: "$amount" }
    }
  },
  { $project: { _id: 0, revenue_month: "$_id", completed_bookings: 1, hotel_revenue: 1 } },
  { $sort: { revenue_month: -1 } }
]);


// 4. Restaurant revenue and order totals by status.
db.orders.aggregate([
  {
    $group: {
      _id: "$status",
      total_orders: { $sum: 1 },
      subtotal_amount: { $sum: "$subtotal" },
      tax_amount: { $sum: "$tax" },
      total_amount: { $sum: "$total" },
      average_order_value: { $avg: "$total" }
    }
  },
  { $project: { _id: 0, status: "$_id", total_orders: 1, subtotal_amount: 1, tax_amount: 1, total_amount: 1, average_order_value: { $round: ["$average_order_value", 2] } } },
  { $sort: { total_orders: -1 } }
]);


// 5. Top selling menu items by quantity and revenue.
db.orders.aggregate([
  { $match: { status: { $ne: "cancelled" } } },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.name",
      category: { $first: "$items.category" },
      quantity_sold: { $sum: "$items.qty" },
      item_revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
    }
  },
  { $project: { _id: 0, item_name: "$_id", category: { $ifNull: ["$category", "Uncategorized"] }, quantity_sold: 1, item_revenue: 1 } },
  { $sort: { quantity_sold: -1, item_revenue: -1 } }
]);


// 6. Staff payroll summary by department and shift.
db.staff.aggregate([
  {
    $group: {
      _id: { department: "$department", shift: "$shift" },
      staff_count: { $sum: 1 },
      total_salary: { $sum: "$salary" },
      average_salary: { $avg: "$salary" }
    }
  },
  { $project: { _id: 0, department: "$_id.department", shift: "$_id.shift", staff_count: 1, total_salary: 1, average_salary: { $round: ["$average_salary", 2] } } },
  { $sort: { department: 1, shift: 1 } }
]);


// 7. Daily business summary combining hotel and restaurant revenue.
// Uses $unionWith to combine hotel bookings and restaurant orders.
db.bookings.aggregate([
  { $match: { status: "checked-out" } },
  {
    $group: {
      _id: { $substr: ["$checkOut", 0, 10] },
      hotel_revenue: { $sum: "$amount" },
      restaurant_revenue: { $literal: 0 }
    }
  },
  {
    $unionWith: {
      coll: "orders",
      pipeline: [
        { $match: { status: "completed" } },
        {
          $group: {
            _id: { $substr: ["$createdAt", 0, 10] },
            hotel_revenue: { $literal: 0 },
            restaurant_revenue: { $sum: "$total" }
          }
        }
      ]
    }
  },
  {
    $group: {
      _id: "$_id",
      hotel_revenue: { $sum: "$hotel_revenue" },
      restaurant_revenue: { $sum: "$restaurant_revenue" }
    }
  },
  {
    $project: {
      _id: 0,
      summary_date: "$_id",
      hotel_revenue: 1,
      restaurant_revenue: 1,
      total_revenue: { $add: ["$hotel_revenue", "$restaurant_revenue"] }
    }
  },
  { $sort: { summary_date: -1 } }
]);
