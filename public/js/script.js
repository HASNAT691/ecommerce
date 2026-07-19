// Get the necessary elements
const profileSection = document.querySelector('.profile-section');
const profilePic = document.getElementById('profile-pic');
const profileBorder = document.querySelector('.profile-border');
const floatingIntro = document.getElementById('floating-intro');

// Variables for managing hover state
let isHovered = false;
let timeoutId = null;

// Function to show introduction
const showIntro = () => {
    isHovered = true;
    clearTimeout(timeoutId);
    
    // Show and animate the intro
    floatingIntro.style.display = 'block';
    requestAnimationFrame(() => {
        floatingIntro.style.opacity = '1';
        floatingIntro.style.transform = 'translateX(0)';
    });
    
    // Add hover effects to profile
    profilePic.style.transform = 'scale(1.05)';
    profileBorder.style.animation = 'rotate 5s linear infinite';
};

const hideIntro = () => {
    isHovered = false;
    floatingIntro.style.opacity = '0';
    floatingIntro.style.transform = 'translateX(50px)';
    profilePic.style.transform = 'scale(1)';
    profileBorder.style.animation = 'rotate 10s linear infinite';
    
    timeoutId = setTimeout(() => {
        if (!isHovered) {
            floatingIntro.style.display = 'none';
        }
    }, 300);
};

profileSection.addEventListener('mouseenter', showIntro);
profileSection.addEventListener('mouseleave', hideIntro);

profileSection.addEventListener('touchstart', (e) => {
    e.preventDefault();
    
    if (floatingIntro.style.display === 'none' || floatingIntro.style.display === '') {
        showIntro();
    } else {
        hideIntro();
    }
});

document.addEventListener('click', (e) => {
    if (!profileSection.contains(e.target) && !floatingIntro.contains(e.target)) {
        hideIntro();
    }
});

window.addEventListener('resize', () => {
    if (floatingIntro.style.display === 'block') {
        // Get profile section position
        const profileRect = profileSection.getBoundingClientRect();
        floatingIntro.style.top = `${profileRect.top}px`;
        floatingIntro.style.right = '20px';
    }
});