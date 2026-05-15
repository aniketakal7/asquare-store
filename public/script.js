document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Add scroll effect to navbar
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.padding = '1rem 0';
            navbar.style.background = 'rgba(15, 23, 42, 0.95)';
        } else {
            navbar.style.padding = '1.5rem 0';
            navbar.style.background = 'rgba(15, 23, 42, 0.8)';
        }
    });

    // Fetch app info (Static fallback for Netlify)
    const fallbackData = { version: "1.0.4", size: "69MB" };
    
    fetch('/api/app-info')
        .then(res => res.json())
        .then(data => {
            updateUI(data);
        })
        .catch(err => {
            console.log('Using static fallback for app info');
            updateUI(fallbackData);
        });

    function updateUI(data) {
        const trustBadge = document.querySelector('.trust-badge');
        if (trustBadge) {
            trustBadge.innerHTML = `✓ Verified Safe • v${data.version} • ${data.size}`;
        }
    }

    // Handle download button (Direct link for Netlify)
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.addEventListener('click', (e) => {
        // Use relative path for better compatibility
        window.location.href = 'apps/app-release.apk';
    });

    // --- Apps Dropdown Logic ---
    const dropdownBtn = document.getElementById('more-apps-btn');
    const dropdownMenu = document.getElementById('more-apps-dropdown');

    // Toggle dropdown
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling up to window
        const isVisible = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Close dropdown if clicking outside
    window.addEventListener('click', (event) => {
        if (!dropdownBtn.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    });

    // --- Scroll Animations Logic ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal').forEach(element => {
        observer.observe(element);
    });
});
