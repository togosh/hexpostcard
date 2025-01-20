function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const isHidden = mobileMenu.classList.contains('hidden');
            
            // Toggle menu visibility
            if (isHidden) {
                mobileMenu.classList.remove('hidden');
            } else {
                mobileMenu.classList.add('hidden');
            }
            
            // Update icon
            const svgPath = this.querySelector('svg path');
            if (svgPath) {
                if (isHidden) {
                    // Show X icon
                    svgPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
                } else {
                    // Show hamburger icon
                    svgPath.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
                }
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                const svgPath = mobileMenuButton.querySelector('svg path');
                if (svgPath) {
                    // Reset to hamburger
                    svgPath.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
                }
            }
        });
    }
}
