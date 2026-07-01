const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    items: { type: Array, required: true },
    total: { type: Number, required: true },
    date: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
