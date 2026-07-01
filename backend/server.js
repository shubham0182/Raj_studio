const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'raj-studio-gift-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database setup
const DB_PATH = path.join(__dirname, 'database.sqlite');
let db = null;

function saveDb() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (e) {
        console.error('Failed to save database:', e.message);
    }
}

async function initDatabase() {
    const SQL = await initSqlJs();
    let savedBuffer = null;
    if (fs.existsSync(DB_PATH)) {
        savedBuffer = fs.readFileSync(DB_PATH);
    }
    db = new SQL.Database(savedBuffer);

    db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'fas fa-tag'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        icon TEXT NOT NULL DEFAULT 'fas fa-box',
        description TEXT DEFAULT ''
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT DEFAULT '',
        message TEXT NOT NULL,
        date TEXT NOT NULL
    )`);

    // Seed default admin if not exists
    const adminRow = db.exec('SELECT id FROM admin WHERE username = \'admin\'');
    if (adminRow.length === 0 || adminRow[0].values.length === 0) {
        const hashed = bcrypt.hashSync('raj123', 10);
        db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hashed]);
        console.log('Default admin created (username: admin, password: raj123)');
    }

    // Seed default categories if empty
    const catRow = db.exec('SELECT COUNT(*) as count FROM categories');
    if (catRow.length > 0 && catRow[0].values[0][0] === 0) {
        const defaultCategories = [
            ['tshirt', 'T-shirt Printing', 'fas fa-tshirt'],
            ['mug', 'Mug Printing', 'fas fa-mug-hot'],
            ['frame', 'Photo Frames', 'fas fa-image'],
            ['pen', 'Pen Printing', 'fas fa-pen']
        ];
        defaultCategories.forEach(c => {
            db.run('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)', c);
        });
        console.log('Default categories seeded');
    }

    // Seed default products if empty
    const prodRow = db.exec('SELECT COUNT(*) as count FROM products');
    if (prodRow.length > 0 && prodRow[0].values[0][0] === 0) {
        const defaultProducts = [
            ['Premium Cotton T-Shirt', 'tshirt', 24.99, 'fas fa-tshirt', '100% premium cotton with vibrant print quality'],
            ['Classic Polo T-Shirt', 'tshirt', 29.99, 'fas fa-tshirt', 'Elegant polo design for corporate events'],
            ['Ceramic Coffee Mug', 'mug', 12.99, 'fas fa-mug-hot', 'Premium ceramic mug with custom printing'],
            ['Travel Insulated Mug', 'mug', 18.99, 'fas fa-mug-hot', 'Double-wall insulated for hot & cold drinks'],
            ['Wooden Photo Frame', 'frame', 15.99, 'fas fa-image', 'Handcrafted wooden frame with glass cover'],
            ['Acrylic Modern Frame', 'frame', 19.99, 'fas fa-image', 'Sleek acrylic design for contemporary spaces'],
            ['Executive Ballpoint Pen', 'pen', 8.99, 'fas fa-pen', 'Metal barrel with smooth writing mechanism'],
            ['Fountain Pen Set', 'pen', 34.99, 'fas fa-pen-fancy', 'Luxury fountain pen with ink and gift box']
        ];
        defaultProducts.forEach(p => {
            db.run('INSERT INTO products (name, category, price, icon, description) VALUES (?, ?, ?, ?, ?)', p);
        });
        console.log('Default products seeded');
    }

    saveDb();
}

function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(sql, params = []) {
    const all = queryAll(sql, params);
    return all.length > 0 ? all[0] : null;
}

function run(sql, params = []) {
    db.run(sql, params);
    saveDb();
}

// Auth middleware
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

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed'));
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ============================================
// API Routes
// ============================================

// Auth
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = queryOne('SELECT * FROM admin WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: admin.username });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, username: req.admin.username });
});

// Categories
app.get('/api/categories', (req, res) => {
    const categories = queryAll('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
});

app.post('/api/categories', authenticateToken, (req, res) => {
    const { id, name, icon } = req.body;
    if (!id || !name) {
        return res.status(400).json({ error: 'ID and name are required' });
    }
    try {
        run('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)', [id, name, icon || 'fas fa-tag']);
        res.json({ success: true, id });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Category ID already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    run('DELETE FROM products WHERE category = ?', [id]);
    run('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true });
});

// Products
app.get('/api/products', (req, res) => {
    const products = queryAll('SELECT * FROM products ORDER BY id ASC');
    res.json(products);
});

app.post('/api/products', authenticateToken, upload.single('image'), (req, res) => {
    const { name, category, price, description, icon } = req.body;
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }

    let finalIcon = icon || 'fas fa-box';
    if (req.file) {
        finalIcon = '/uploads/' + req.file.filename;
    }

    run('INSERT INTO products (name, category, price, icon, description) VALUES (?, ?, ?, ?, ?)',
        [name, category, parseFloat(price), finalIcon, description || '']);

    const product = queryOne('SELECT * FROM products WHERE id = last_insert_rowid()');
    res.json(product);
});

app.put('/api/products/:id', authenticateToken, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { name, category, price, description, icon } = req.body;

    const existing = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(id)]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    let finalIcon = existing.icon;
    if (req.file) {
        finalIcon = '/uploads/' + req.file.filename;
        if (existing.icon && existing.icon.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, existing.icon);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
    } else if (icon !== undefined) {
        finalIcon = icon;
    }

    run('UPDATE products SET name = ?, category = ?, price = ?, icon = ?, description = ? WHERE id = ?',
        [
            name || existing.name,
            category || existing.category,
            price ? parseFloat(price) : existing.price,
            finalIcon,
            description !== undefined ? description : existing.description,
            parseInt(id)
        ]);

    const updated = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(id)]);
    res.json(updated);
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const product = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(id)]);
    if (product && product.icon && product.icon.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, product.icon);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    run('DELETE FROM products WHERE id = ?', [parseInt(id)]);
    res.json({ success: true });
});

// Submissions
app.get('/api/submissions', authenticateToken, (req, res) => {
    const submissions = queryAll('SELECT * FROM submissions ORDER BY rowid DESC');
    res.json(submissions);
});

app.post('/api/submissions', (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const date = new Date().toLocaleString();
    run('INSERT INTO submissions (name, email, phone, message, date) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone || '', message, date]);

    const result = queryOne('SELECT last_insert_rowid() as id');
    res.json({ success: true, id: result ? result.id : null });
});

app.delete('/api/submissions/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    run('DELETE FROM submissions WHERE id = ?', [parseInt(id)]);
    res.json({ success: true });
});

// Image upload (standalone endpoint for admin)
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: '/uploads/' + req.file.filename });
});

// ============================================
// Static file serving (frontend)
// ============================================
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
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

// Start server
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Raj Studio Gift backend running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
