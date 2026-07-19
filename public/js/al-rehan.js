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


    // search icon behaviour
    const navbarSearchIcon = document.getElementById("navbarSearchIcon");
    const navbarSearchInput = document.getElementById("navbarSearchInput");

    const offcanvasSearchIcon = document.getElementById("offcanvasSearchIcon");
    const offcanvasSearchInput = document.getElementById("offcanvasSearchInput");

    if (navbarSearchIcon && navbarSearchInput) {
        // Toggle Navbar Search Field
        navbarSearchIcon.addEventListener("click", function (e) {
            e.preventDefault();
            navbarSearchInput.classList.toggle("d-none");
            navbarSearchInput.focus();
        });

        // Hide when focus is lost
        navbarSearchInput.addEventListener("blur", function () {
            navbarSearchInput.classList.add("d-none");
        });
    }

    if (offcanvasSearchIcon && offcanvasSearchInput) {
        // Toggle Offcanvas Search Field
        offcanvasSearchIcon.addEventListener("click", function (e) {
            e.preventDefault();
            offcanvasSearchInput.classList.toggle("d-none");
            offcanvasSearchInput.focus();
        });

        // Hide when focus is lost
        offcanvasSearchInput.addEventListener("blur", function () {
            offcanvasSearchInput.classList.add("d-none");
        });
    }
});
