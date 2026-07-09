const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    message: { type: String, required: true },
    date: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
