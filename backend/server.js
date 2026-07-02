require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const Admin = require('./models/Admin');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Submission = require('./models/Submission');
const Order = require('./models/Order');
const Gallery = require('./models/Gallery');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/rajstudio';
const JWT_SECRET = process.env.JWT_SECRET || 'raj-studio-gift-secret-key-2026';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

var uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Store uploaded images permanently on Cloudinary (cloud storage)
const useCloudinary = true;
var storage, upload;
if (useCloudinary) {
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'raj-studio',
            allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'],
            transformation: [{ width: 800, height: 800, crop: 'limit' }]
        }
    });
    upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });
    console.log('Using Cloudinary for image storage');
} else {
    storage = multer.diskStorage({
        destination: path.join(__dirname, 'uploads'),
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({
        storage: storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: function (req, file, cb) {
            const allowed = /jpeg|jpg|png|gif|webp|svg/;
            const ext = allowed.test(path.extname(file.originalname).toLowerCase());
            const mime = allowed.test(file.mimetype);
            if (ext && mime) return cb(null, true);
            cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed'));
        }
    });
}

async function seedData() {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
        const hashed = bcrypt.hashSync('raj123', 10);
        await Admin.create({ username: 'admin', password: hashed });
        console.log('Default admin created (username: admin, password: raj123)');
    }

    const catCount = await Category.countDocuments();
    if (catCount === 0) {
        await Category.insertMany([
            { id: 'tshirt', name: 'T-shirt Printing', icon: 'fas fa-tshirt' },
            { id: 'mug', name: 'Mug Printing', icon: 'fas fa-mug-hot' },
            { id: 'frame', name: 'Photo Frames', icon: 'fas fa-image' },
            { id: 'pen', name: 'Pen Printing', icon: 'fas fa-pen' }
        ]);
        console.log('Default categories seeded');
    }

    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
        await Product.insertMany([
            { name: 'Premium Cotton T-Shirt', category: 'tshirt', price: 24.99, icon: 'fas fa-tshirt', description: '100% premium cotton with vibrant print quality' },
            { name: 'Classic Polo T-Shirt', category: 'tshirt', price: 29.99, icon: 'fas fa-tshirt', description: 'Elegant polo design for corporate events' },
            { name: 'Ceramic Coffee Mug', category: 'mug', price: 12.99, icon: 'fas fa-mug-hot', description: 'Premium ceramic mug with custom printing' },
            { name: 'Travel Insulated Mug', category: 'mug', price: 18.99, icon: 'fas fa-mug-hot', description: 'Double-wall insulated for hot & cold drinks' },
            { name: 'Wooden Photo Frame', category: 'frame', price: 15.99, icon: 'fas fa-image', description: 'Handcrafted wooden frame with glass cover' },
            { name: 'Acrylic Modern Frame', category: 'frame', price: 19.99, icon: 'fas fa-image', description: 'Sleek acrylic design for contemporary spaces' },
            { name: 'Executive Ballpoint Pen', category: 'pen', price: 8.99, icon: 'fas fa-pen', description: 'Metal barrel with smooth writing mechanism' },
            { name: 'Fountain Pen Set', category: 'pen', price: 34.99, icon: 'fas fa-pen-fancy', description: 'Luxury fountain pen with ink and gift box' }
        ]);
        console.log('Default products seeded');
    }
}

app.get('/api/status', (req, res) => {
    const dbState = mongoose.connection.readyState;
    res.json({
        server: true,
        mongodb: dbState === 1,
        mongodbState: dbState
    });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: admin.username });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, username: req.admin.username });
});

app.get('/api/categories', async (req, res) => {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { id, name, icon } = req.body;
    if (!id || !name) {
        return res.status(400).json({ error: 'ID and name are required' });
    }
    const exists = await Category.findOne({ id });
    if (exists) return res.status(409).json({ error: 'Category ID already exists' });

    await Category.create({ id, name, icon: icon || 'fas fa-tag' });
    res.json({ success: true, id });
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    await Product.deleteMany({ category: id });
    await Category.deleteOne({ id });
    res.json({ success: true });
});

app.get('/api/products', async (req, res) => {
    const products = await Product.find().sort({ _id: 1 });
    res.json(products);
});

app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name, category, price, description, icon } = req.body;
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }

        let finalIcon = icon || 'fas fa-box';
        if (req.file) {
            finalIcon = useCloudinary ? req.file.path : '/uploads/' + req.file.filename;
        }

        const product = await Product.create({
            name,
            category,
            price: parseFloat(price),
            icon: finalIcon,
            description: description || ''
        });

        res.json(product);
    } catch (err) {
        console.error('Product create error:', err);
        res.status(400).json({ error: err.message || 'Failed to create product' });
    }
});

app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, category, price, description, icon } = req.body;

    const existing = await Product.findById(id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    let finalIcon = existing.icon;
    if (req.file) {
        finalIcon = useCloudinary ? req.file.path : '/uploads/' + req.file.filename;
        if (useCloudinary && existing.icon && existing.icon.includes('res.cloudinary.com')) {
            const publicId = existing.icon.split('/').pop().split('.')[0];
            cloudinary.uploader.destroy('raj-studio/' + publicId).catch(function() {});
        } else if (existing.icon && existing.icon.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, existing.icon);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
    } else if (icon !== undefined) {
        finalIcon = icon;
    }

    const updated = await Product.findByIdAndUpdate(id, {
        name: name || existing.name,
        category: category || existing.category,
        price: price ? parseFloat(price) : existing.price,
        icon: finalIcon,
        description: description !== undefined ? description : existing.description
    }, { new: true });

    res.json(updated);
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (product && product.icon) {
        if (product.icon.includes('res.cloudinary.com')) {
            const publicId = 'raj-studio/' + product.icon.split('/').pop().split('.')[0];
            cloudinary.uploader.destroy(publicId).catch(function() {});
        } else if (product.icon.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, product.icon);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }
    await Product.findByIdAndDelete(id);
    res.json({ success: true });
});

app.get('/api/submissions', authenticateToken, async (req, res) => {
    const submissions = await Submission.find().sort({ _id: -1 });
    res.json(submissions);
});

app.post('/api/submissions', async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const date = new Date().toLocaleString();
    const result = await Submission.create({ name, email, phone: phone || '', message, date });
    res.json({ success: true, id: result._id });
});

app.delete('/api/submissions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    await Submission.findByIdAndDelete(id);
    res.json({ success: true });
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    const orders = await Order.find().sort({ _id: -1 });
    res.json(orders);
});

app.post('/api/orders', async (req, res) => {
    const { name, email, phone, items, total, image } = req.body;
    if (!name || !email || !items || !items.length) {
        return res.status(400).json({ error: 'Name, email, and items are required' });
    }

    const date = new Date().toLocaleString();
    const result = await Order.create({ name, email, phone: phone || '', items, total, date, image: image || '' });
    res.json({ success: true, id: result._id });
});

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    await Order.findByIdAndDelete(id);
    res.json({ success: true });
});

app.get('/api/gallery', async (req, res) => {
    const images = await Gallery.find().sort({ _id: -1 });
    res.json(images);
});

app.post('/api/gallery', authenticateToken, async (req, res) => {
    const { image, caption } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });
    const date = new Date().toLocaleString();
    const result = await Gallery.create({ image, caption: caption || '', date });
    res.json({ success: true, id: result._id });
});

app.delete('/api/gallery/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const item = await Gallery.findById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.image && item.image.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, item.image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Gallery.findByIdAndDelete(id);
    res.json({ success: true });
});

app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: useCloudinary ? req.file.path : '/uploads/' + req.file.filename });
});

const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Max size is 5MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('Only image files')) {
        return res.status(400).json({ error: err.message });
    }
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("MongoDB Connected");
        await seedData();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Raj Studio Gift backend running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => console.error("MongoDB Error:", err));
