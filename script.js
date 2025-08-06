// Biztonságos, modern JavaScript modul
(function() {
    // Szigorú mód a jobb hibakezelésért
    'use strict';

    // Globális alkalmazás objektum
    const App = {
        // Inicializáló metódus
        init() {
            this.cacheDOM();
            this.bindEvents();
            this.initializeFeatures();
        },

        // DOM elemek gyorsítótárazása
        cacheDOM() {
            this.elements = {
                mobileMenuToggle: document.querySelector('.menu-toggle'),
                navMenu: document.querySelector('.nav-links'),
                contactForm: document.querySelector('#contact-form'),
                darkModeToggle: document.querySelector('#dark-mode-toggle'),
                scrollToTopBtn: document.querySelector('#scroll-top'),
                lazyImages: document.querySelectorAll('.lazy-load')
            };
        },

        // Eseménykezelők beállítása
        bindEvents() {
            if (this.elements.mobileMenuToggle) {
                this.elements.mobileMenuToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
            }

            if (this.elements.contactForm) {
                this.elements.contactForm.addEventListener('submit', this.handleFormSubmission.bind(this));
            }

            if (this.elements.darkModeToggle) {
                this.elements.darkModeToggle.addEventListener('click', this.toggleDarkMode.bind(this));
            }

            if (this.elements.scrollToTopBtn) {
                window.addEventListener('scroll', this.toggleScrollToTop.bind(this));
                this.elements.scrollToTopBtn.addEventListener('click', this.scrollToTop.bind(this));
            }

            // Képek lusta betöltése
            this.lazyLoadImages();
        },

        // Mobil menü váltása
        toggleMobileMenu() {
            this.elements.navMenu.classList.toggle('active');
            this.elements.mobileMenuToggle.classList.toggle('open');
        },

        // Form küldés kezelése
        handleFormSubmission(event) {
            event.preventDefault();
            
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());

            // Egyszerű validáció
            if (this.validateForm(data)) {
                this.submitForm(data);
            }
        },

        // Form validáció
        validateForm(data) {
            const errors = [];

            if (!data.name || data.name.trim() === '') {
                errors.push('Név megadása kötelező');
            }

            if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) {
                errors.push('Érvényes email cím szükséges');
            }

            if (errors.length > 0) {
                this.displayFormErrors(errors);
                return false;
            }

            return true;
        },

        // Form küldés
        submitForm(data) {
            fetch('/submit-form', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                this.showNotification('Sikeres küldés!', 'success');
            })
            .catch(error => {
                this.showNotification('Hiba történt a küldés során', 'error');
                console.error('Hiba:', error);
            });
        },

        // Sötét mód váltás
        toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode'));
        },

        // Görgetés tetejére
        scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        },

        // Görgetés gomb megjelenítése
        toggleScrollToTop() {
            if (window.scrollY > 300) {
                this.elements.scrollToTopBtn.classList.add('visible');
            } else {
                this.elements.scrollToTopBtn.classList.remove('visible');
            }
        },

        // Képek lusta betöltése
        lazyLoadImages() {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const image = entry.target;
                        image.src = image.dataset.src;
                        image.classList.add('loaded');
                        observer.unobserve(image);
                    }
                });
            }, { rootMargin: '50px' });

            this.elements.lazyImages.forEach(image => {
                imageObserver.observe(image);
            });
        },

        // Értesítések megjelenítése
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.classList.add('notification', type);
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 600);
            }, 3000);
        },

        // Kezdeti funkciók
        initializeFeatures() {
            // Sötét mód állapot betöltése
            const savedDarkMode = localStorage.getItem('dark-mode') === 'true';
            if (savedDarkMode) {
                document.body.classList.add('dark-mode');
            }

            // Animációk inicializálása
            this.initAnimations();
        },

        // Animációk kezelése
        initAnimations() {
            const animatedElements = document.querySelectorAll('.animate-on-scroll');
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animated');
                    }
                });
            }, { threshold: 0.1 });

            animatedElements.forEach(element => {
                observer.observe(element);
            });
        }
    };

    // Alkalmazás inicializálása, amikor a DOM betöltődött
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
})();
