document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.gallery-section');
    
    // Create dots container
    const dotsContainer = document.createElement('div');
    dotsContainer.classList.add('dots');
    document.body.appendChild(dotsContainer);

    // Create dots
    sections.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dot.addEventListener('click', () => scrollToSection(index));
        dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('.dot');

    function scrollToSection(index) {
        sections[index].scrollIntoView({ behavior: 'smooth' });
    }

    function updateActiveDot() {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;

        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= windowHeight/2 && rect.bottom >= windowHeight/2) {
                dots.forEach(dot => dot.classList.remove('active'));
                dots[index].classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', updateActiveDot);
    updateActiveDot();


    // Search Overlay behavior
    const navbarSearchIcon = document.getElementById("navbarSearchIcon");
    const siteSearchOverlay = document.getElementById("siteSearchOverlay");
    const siteSearchInput = document.getElementById("siteSearchInput");
    const closeSearchBtn = document.getElementById("closeSearchBtn");

    if (navbarSearchIcon && siteSearchOverlay) {
        navbarSearchIcon.addEventListener("click", function (e) {
            e.preventDefault();
            siteSearchOverlay.classList.toggle("d-none");
            if (!siteSearchOverlay.classList.contains("d-none") && siteSearchInput) {
                setTimeout(() => { siteSearchInput.focus(); }, 100);
            }
        });
    }

    if (closeSearchBtn && siteSearchOverlay) {
        closeSearchBtn.addEventListener("click", function () {
            siteSearchOverlay.classList.add("d-none");
        });
    }
});
