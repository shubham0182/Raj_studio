/* ============================================ */
/* Raj Studio Gift - JavaScript Functionality */
/* ============================================ */

(function() {
    'use strict';

    // ============================================
    // DOM Elements - Initialize after DOM ready
    // ============================================
    let preloader, navbar, navLinks, hamburger, cartSidebar, cartOverlay;
    let closeCartBtn, cartItemsContainer, cartTotalEl, checkoutBtn;
    let filterBtns, productsGrid, contactForm;
    let cart = [];
    let cartCount = 0;

    // ============================================
    // Product & Category Data (API + localStorage cache)
    // ============================================
    const API_BASE = location.protocol === 'file:' ? 'http://localhost:3000' : '';

    var _products = null;
    var _categories = null;

    var defaultCategories = [
        { id: 'tshirt', name: 'T-shirt Printing', icon: 'fas fa-tshirt' },
        { id: 'mug', name: 'Mug Printing', icon: 'fas fa-mug-hot' },
        { id: 'frame', name: 'Photo Frames', icon: 'fas fa-image' },
        { id: 'pen', name: 'Pen Printing', icon: 'fas fa-pen' }
    ];

    var defaultProducts = [
        { id: 1, name: "Premium Cotton T-Shirt", category: "tshirt", price: 24.99, icon: "fas fa-tshirt", description: "100% premium cotton with vibrant print quality" },
        { id: 2, name: "Classic Polo T-Shirt", category: "tshirt", price: 29.99, icon: "fas fa-tshirt", description: "Elegant polo design for corporate events" },
        { id: 3, name: "Ceramic Coffee Mug", category: "mug", price: 12.99, icon: "fas fa-mug-hot", description: "Premium ceramic mug with custom printing" },
        { id: 4, name: "Travel Insulated Mug", category: "mug", price: 18.99, icon: "fas fa-mug-hot", description: "Double-wall insulated for hot & cold drinks" },
        { id: 5, name: "Wooden Photo Frame", category: "frame", price: 15.99, icon: "fas fa-image", description: "Handcrafted wooden frame with glass cover" },
        { id: 6, name: "Acrylic Modern Frame", category: "frame", price: 19.99, icon: "fas fa-image", description: "Sleek acrylic design for contemporary spaces" },
        { id: 7, name: "Executive Ballpoint Pen", category: "pen", price: 8.99, icon: "fas fa-pen", description: "Metal barrel with smooth writing mechanism" },
        { id: 8, name: "Fountain Pen Set", category: "pen", price: 34.99, icon: "fas fa-pen-fancy", description: "Luxury fountain pen with ink and gift box" }
    ];

    function getLocalFallback(key, defaults) {
        var stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
        if (defaults) localStorage.setItem(key, JSON.stringify(defaults));
        return defaults || [];
    }

    async function loadData() {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function() { controller.abort(); }, 3000);
            var [prods, cats] = await Promise.all([
                fetch(API_BASE + '/api/products', { signal: controller.signal }).then(function(r) { return r.ok ? r.json() : Promise.reject(); }),
                fetch(API_BASE + '/api/categories', { signal: controller.signal }).then(function(r) { return r.ok ? r.json() : Promise.reject(); })
            ]);
            clearTimeout(timeout);
            _products = prods;
            _categories = cats;
            localStorage.setItem('rajStudio_products', JSON.stringify(prods));
            localStorage.setItem('rajStudio_categories', JSON.stringify(cats));
        } catch (e) {
            _products = getLocalFallback('rajStudio_products', defaultProducts);
            _categories = getLocalFallback('rajStudio_categories', defaultCategories);
        }
    }

    function getCategories() {
        return _categories || getLocalFallback('rajStudio_categories', defaultCategories);
    }

    function getProducts() {
        return _products || getLocalFallback('rajStudio_products', defaultProducts);
    }

    function rebuildFilterButtons() {
        var container = document.querySelector('.filters');
        if (!container) return;
        var cats = getCategories();
        container.innerHTML = '<button class="filter-btn active" data-filter="all">All</button>';
        cats.forEach(function(c) {
            container.innerHTML += '<button class="filter-btn" data-filter="' + c.id + '">' + c.name + '</button>';
        });
        filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', handleFilter);
        });
    }

    // ============================================
    // Logo Typewriter Effect
    // ============================================
    function typeLogo() {
        const logo = document.querySelector('.logo');
        if (!logo) return;

        const parts = [
            { text: 'RAJ', class: 'raj' },
            { text: ' STUDIO ', class: '' },
            { text: 'GIFT', class: 'gift' }
        ];

        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        cursor.textContent = '|';

        logo.innerHTML = '';
        logo.appendChild(cursor);

        let partIdx = 0, charIdx = 0;
        let currentEl = null;

        function type() {
            if (partIdx >= parts.length) {
                setTimeout(() => { cursor.style.opacity = '0'; }, 1200);
                return;
            }

            const part = parts[partIdx];

            if (charIdx === 0) {
                currentEl = document.createElement('span');
                if (part.class) currentEl.className = part.class;
                logo.insertBefore(currentEl, cursor);
            }

            if (charIdx < part.text.length) {
                currentEl.textContent += part.text[charIdx];
                charIdx++;
                setTimeout(type, 80);
            } else {
                partIdx++;
                charIdx = 0;
                setTimeout(type, 150);
            }
        }

        setTimeout(type, 600);
    }

    // ============================================
    // Initialize Application
    // ============================================
    async function init() {
        // Get DOM elements
        preloader = document.querySelector('.preloader');
        navbar = document.querySelector('header');
        navLinks = document.querySelector('.nav-links');
        hamburger = document.querySelector('.hamburger');
        cartSidebar = document.getElementById('cartSidebar');
        cartOverlay = document.createElement('div');
        cartOverlay.className = 'cart-overlay';
        document.body.appendChild(cartOverlay);
        closeCartBtn = document.getElementById('closeCart');
        cartItemsContainer = document.getElementById('cartItems');
        cartTotalEl = document.getElementById('cartTotal');
        checkoutBtn = document.getElementById('checkoutBtn');
        filterBtns = document.querySelectorAll('.filter-btn');
        productsGrid = document.querySelector('.products-grid');
        contactForm = document.getElementById('contactForm');

        // Load data from API (with localStorage fallback)
        await loadData();

        // Load cart from localStorage
        loadCart();

        // Build filter buttons from dynamic categories
        rebuildFilterButtons();

        // Render products
        renderProducts(getProducts());

        // Setup event listeners
        setupEventListeners();

        // Logo typewriter effect
        typeLogo();

        // Hide preloader
        setTimeout(() => {
            if (preloader) {
                preloader.classList.add('hidden');
            }
        }, 800);

        // Initialize scroll reveal
        initScrollReveal();

        // Close cart on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cartSidebar.classList.contains('open')) {
                closeCart();
            }
        });

        // Handle window resize
        window.addEventListener('resize', handleResize);
    }

    // ============================================
    // Handle Window Resize
    // ============================================
    function handleResize() {
        // Close mobile menu on resize to desktop
        if (window.innerWidth > 768) {
            navLinks.classList.remove('open');
            hamburger.classList.remove('open');
        }
    }

    // ============================================
    // Event Listeners Setup
    // ============================================
    function setupEventListeners() {
        // Scroll event for navbar
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            if (!scrollTimeout) {
                scrollTimeout = setTimeout(function() {
                    handleScroll();
                    scrollTimeout = null;
                }, 10);
            }
        });

        // Hamburger menu
        if (hamburger) {
            hamburger.addEventListener('click', toggleMobileMenu);
        }

        // Close mobile menu on link click
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                hamburger.classList.remove('open');
            });
        });

        // Cart sidebar
        if (closeCartBtn) {
            closeCartBtn.addEventListener('click', closeCart);
        }
        cartOverlay.addEventListener('click', closeCart);

        // Filter buttons
        filterBtns.forEach(btn => {
            btn.addEventListener('click', handleFilter);
        });

        // Checkout button
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', handleCheckout);
        }

        // Contact form
        if (contactForm) {
            contactForm.addEventListener('submit', handleContactSubmit);
        }

        // Smooth scroll for anchor links (skip page nav links)
        var pageLinks = ['home', 'products', 'customize', 'contact', 'admin'];
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                var href = this.getAttribute('href');
                var id = href.replace('#', '');
                if (href !== '#' && pageLinks.indexOf(id) === -1) {
                    e.preventDefault();
                    var target = document.querySelector(href);
                    if (target) {
                        var offsetTop = target.offsetTop - (window.innerWidth > 768 ? 80 : 70);
                        window.scrollTo({
                            top: Math.max(0, offsetTop),
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });

        // Touch support for mobile devices
        document.addEventListener('touchstart', function() {}, {passive: true});
    }

    // ============================================
    // Scroll Handler
    // ============================================
    function handleScroll() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // ============================================
    // Mobile Menu Toggle
    // ============================================
    function toggleMobileMenu() {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
    }

    // ============================================
    // Scroll Reveal Animation
    // ============================================
    function initScrollReveal() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe section headers
        document.querySelectorAll('.section-header').forEach(el => {
            observer.observe(el);
        });

        // Observe product cards
        document.querySelectorAll('.product-card').forEach(el => {
            observer.observe(el);
        });

        // Observe feature cards
        document.querySelectorAll('.feature-card').forEach(el => {
            observer.observe(el);
        });

        // Observe option cards
        document.querySelectorAll('.option-card').forEach(el => {
            observer.observe(el);
        });

        // Observe contact elements
        document.querySelectorAll('.info-item').forEach(el => {
            observer.observe(el);
        });

        const contactMap = document.querySelector('.contact-map');
        if (contactMap) observer.observe(contactMap);

        const contactFormEl = document.querySelector('.contact-form');
        if (contactFormEl) observer.observe(contactFormEl);
    }

    // ============================================
    // Product Rendering
    // ============================================
    function renderProducts(productsToRender) {
        if (!productsGrid) return;

        productsGrid.innerHTML = '';

        productsToRender.forEach((product, index) => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.transitionDelay = `${index * 0.1}s`;
            var isImageUrl = product.icon && (product.icon.indexOf('data:image') === 0 || product.icon.indexOf('/uploads/') === 0 || product.icon.indexOf('http') === 0);
            var imageHtml = isImageUrl
                ? '<img src="' + product.icon + '" alt="' + product.name + '" style="width:100%;height:100%;object-fit:cover;">'
                : '<i class="' + (product.icon || 'fas fa-box') + '"></i>';
            card.innerHTML = `
                <div class="product-image">
                    ${imageHtml}
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <span class="product-price">₹${product.price.toFixed(2)}</span>
                    <button class="add-to-cart" data-id="${product.id}">
                        <i class="fas fa-shopping-cart"></i> Add to Cart
                    </button>
                </div>
            `;
            productsGrid.appendChild(card);
        });

        // Add event listeners to Add to Cart buttons
        document.querySelectorAll('.add-to-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const productId = parseInt(this.getAttribute('data-id'));
                addToCart(productId);
            });
        });
    }

    // ============================================
    // Filter Handler
    // ============================================
    function handleFilter(e) {
        const filter = e.target.getAttribute('data-filter');

        // Update active button
        filterBtns.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // Filter products
        var allProducts = getProducts();
        var filteredProducts;
        if (filter === 'all') {
            filteredProducts = allProducts;
        } else {
            filteredProducts = allProducts.filter(function(p) { return p.category === filter; });
        }

        renderProducts(filteredProducts);
        initScrollReveal(); // Re-init for new cards
    }

    // ============================================
    // Google Sheets Config
    // ============================================
    // IMPORTANT: Replace this with your Google Apps Script Web App URL after deployment
    const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

    // ============================================
    // Save to Google Sheet
    // ============================================
    async function saveToGoogleSheet(data) {
        try {
            // Skip if using placeholder URL
            if (GOOGLE_SHEET_URL.includes('YOUR_DEPLOYMENT_ID')) {
                console.log('Google Sheets URL not configured yet. Skipping sync.');
                return;
            }

            await fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (err) {
            console.warn('Failed to sync with Google Sheet:', err);
        }
    }

    // ============================================
    // Cart Functions
    // ============================================
    function addToCart(productId) {
        const product = getProducts().find(p => p.id === productId);
        if (!product) return;

        const existingItem = cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                icon: product.icon,
                quantity: 1
            });
        }

        saveCart();
        updateCartUI();

        // Save to Google Sheet
        saveToGoogleSheet({
            timestamp: new Date().toISOString(),
            product: product.name,
            price: product.price,
            quantity: existingItem ? existingItem.quantity : 1,
            total: (existingItem ? existingItem.quantity : 1) * product.price,
            action: 'Added to Cart'
        });

        showToast(`${product.name} added to cart!`);

        // Animate button
        const btn = document.querySelector(`.add-to-cart[data-id="${productId}"]`);
        if (btn) {
            btn.classList.add('added');
            btn.innerHTML = '<i class="fas fa-check"></i> Added!';
            setTimeout(() => {
                btn.classList.remove('added');
                btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
            }, 1500);
        }
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        updateCartUI();
    }

    function updateQuantity(productId, change) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                removeFromCart(productId);
            } else {
                saveCart();
                updateCartUI();
            }
        }
    }

    function updateCartUI() {
        if (!cartItemsContainer || !cartTotalEl) return;

        // Update cart count in nav (if we had one)
        cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                </div>
            `;
            cartTotalEl.textContent = '₹0.00';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        if (checkoutBtn) checkoutBtn.disabled = false;

        cartItemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">
                    <i class="${item.icon}"></i>
                </div>
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>₹${item.price.toFixed(2)} each</p>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="cart-item-remove" onclick="app.updateQuantity(${item.id}, -1)" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">-</button>
                        <span style="color: var(--gold); font-weight: 600;">${item.quantity}</span>
                        <button class="cart-item-remove" onclick="app.updateQuantity(${item.id}, 1)" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="app.removeFromCart(${item.id})" title="Remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotalEl.textContent = `₹${total.toFixed(2)}`;
    }

    function openCart() {
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function toggleCart() {
        if (cartSidebar.classList.contains('open')) {
            closeCart();
        } else {
            openCart();
        }
    }

    function handleCheckout() {
        if (cart.length === 0) return;

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (confirm(`Proceed to checkout?\n\nTotal: ₹${total.toFixed(2)}\n\nThank you for your order! We'll contact you shortly.`)) {
            // Save full order to Google Sheet
            cart.forEach(item => {
                saveToGoogleSheet({
                    timestamp: new Date().toISOString(),
                    product: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity,
                    action: 'Ordered'
                });
            });

            cart = [];
            saveCart();
            updateCartUI();
            closeCart();
            showToast('Order placed successfully!');
        }
    }

    // ============================================
    // Contact Form Handler
    // ============================================
    function handleContactSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const message = document.getElementById('message').value.trim();

        if (!name || !email || !message) {
            showToast('Please fill in all required fields!', true);
            return;
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Please enter a valid email address!', true);
            return;
        }

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        fetch(API_BASE + '/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, email: email, phone: phone, message: message })
        }).then(function(r) {
            if (!r.ok) throw new Error('Server error');
            return r.json();
        }).then(function() {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            contactForm.reset();
            showToast('Message sent successfully! We\'ll get back to you soon.');
        }).catch(function() {
            // Fallback to localStorage if API is down
            try {
                var subs = JSON.parse(localStorage.getItem('rajStudio_contactSubmissions') || '[]');
                subs.unshift({ name: name, email: email, phone: phone, message: message, date: new Date().toLocaleString() });
                localStorage.setItem('rajStudio_contactSubmissions', JSON.stringify(subs));
            } catch (e) {}
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            contactForm.reset();
            showToast('Message sent successfully! We\'ll get back to you soon.');
        });
    }

    // ============================================
    // Toast Notification
    // ============================================
    function showToast(message, isError = false) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        if (isError) {
            toast.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
        }
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ============================================
    // Cart Persistence
    // ============================================
    function saveCart() {
        try {
            localStorage.setItem('rajStudioGift_cart', JSON.stringify(cart));
        } catch (e) {
            console.warn('Could not save cart to localStorage');
        }
    }

    function loadCart() {
        try {
            const saved = localStorage.getItem('rajStudioGift_cart');
            if (saved) {
                cart = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load cart from localStorage');
            cart = [];
        }
    }

    // ============================================
    // Ripple Effect for Buttons
    // ============================================
    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
        circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
        circle.classList.add('ripple');

        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) {
            ripple.remove();
        }

        button.appendChild(circle);
    }

    // Add ripple to buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('.btn-primary, .btn-secondary, .btn-outline, .add-to-cart')) {
            createRipple(e);
        }
    });

    // ============================================
    // Public API for inline handlers
    // ============================================
    window.app = {
        removeFromCart: removeFromCart,
        updateQuantity: updateQuantity,
        toggleCart: toggleCart,
        refreshData: function() {
            loadData().then(function() {
                rebuildFilterButtons();
                renderProducts(getProducts());
            });
        }
    };

    // ============================================
    // Initialize on DOM ready
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();