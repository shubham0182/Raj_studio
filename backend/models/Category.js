const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, default: 'fas fa-tag' }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
